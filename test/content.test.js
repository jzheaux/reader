import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createContent, PathError, ConflictError } from '../src/content.js';

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-test-'));
  const root = path.join(base, 'root');
  fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
  fs.mkdirSync(path.join(root, '.hidden'));
  fs.mkdirSync(path.join(root, 'node_modules'));
  fs.writeFileSync(path.join(root, 'a.md'), '# a\n');
  fs.writeFileSync(path.join(root, 'sub', 'b.markdown'), 'b\n');
  fs.writeFileSync(path.join(root, 'doc.pdf'), '%PDF-1.4\n');
  fs.writeFileSync(path.join(root, 'notes.txt'), 'skip me\n');
  fs.writeFileSync(path.join(root, '.hidden', 'c.md'), 'hidden\n');
  fs.writeFileSync(path.join(root, 'node_modules', 'd.md'), 'dep\n');
  fs.writeFileSync(path.join(base, 'secret.md'), 'outside\n');
  fs.symlinkSync(path.join(base, 'secret.md'), path.join(root, 'link-out.md'));
  fs.symlinkSync(base, path.join(root, 'dir-out'));
  return { base, root, content: createContent(root) };
}

test('list shows markdown and pdf, skipping hidden, node_modules and escaping links', () => {
  const { content } = fixture();
  const paths = content.list().map((f) => f.path).sort();
  assert.deepEqual(paths, ['a.md', 'doc.pdf', 'sub/b.markdown']);
  assert.equal(content.list().find((f) => f.path === 'doc.pdf').type, 'pdf');
});

test('resolve refuses paths that leave the root', () => {
  const { content } = fixture();
  for (const bad of ['../secret.md', 'sub/../../secret.md', '/etc/passwd', '', '.hidden/c.md',
    'link-out.md', 'dir-out/secret.md', 'a\0.md', '.reader/backups/a.md']) {
    assert.throws(() => content.resolve(bad), PathError, bad);
  }
  assert.ok(content.resolve('sub/b.markdown').endsWith(path.join('sub', 'b.markdown')));
  assert.ok(content.resolve('new/dir/x.md'));
});

test('read returns text and mtime; missing files are 404', () => {
  const { content } = fixture();
  const f = content.read('a.md');
  assert.equal(f.text, '# a\n');
  assert.equal(typeof f.mtime, 'number');
  assert.throws(() => content.read('nope.md'), (e) => e.status === 404);
});

test('write is atomic, checks mtime and refuses non-markdown', () => {
  const { root, content } = fixture();
  const { mtime } = content.read('a.md');
  const out = content.write('a.md', '# a\nmore\n', { baseMtime: mtime });
  assert.equal(fs.readFileSync(path.join(root, 'a.md'), 'utf8'), '# a\nmore\n');
  assert.ok(!fs.readdirSync(root).some((f) => f.endsWith('.tmp')));

  // someone else edits the file
  fs.writeFileSync(path.join(root, 'a.md'), 'theirs\n');
  fs.utimesSync(path.join(root, 'a.md'), new Date(), new Date(Date.now() + 5000));
  assert.throws(() => content.write('a.md', 'mine\n', { baseMtime: out.mtime }), ConflictError);
  assert.equal(fs.readFileSync(path.join(root, 'a.md'), 'utf8'), 'theirs\n');

  content.write('a.md', 'mine\n', { baseMtime: out.mtime, force: true });
  assert.equal(fs.readFileSync(path.join(root, 'a.md'), 'utf8'), 'mine\n');

  assert.throws(() => content.write('doc.pdf', 'x'), PathError);
  assert.throws(() => content.write('../secret.md', 'x'), PathError);
});

test('backups: explicit saves always back up, autosaves are throttled, last 10 kept', () => {
  const { content } = fixture();
  const dir = path.join(content.backupRoot, 'a.md');
  content.write('a.md', 'v1');
  content.write('a.md', 'v2');           // autosave within 5 minutes: no second backup
  assert.equal(fs.readdirSync(dir).length, 1);
  assert.equal(fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0]), 'utf8'), '# a\n');

  for (let i = 0; i < 15; i++) content.write('a.md', `e${i}`, { explicit: true });
  assert.equal(fs.readdirSync(dir).length, 10);

  // saving identical text writes nothing
  const before = fs.readdirSync(dir).length;
  assert.ok(content.write('a.md', 'e14', { explicit: true }).unchanged);
  assert.equal(fs.readdirSync(dir).length, before);
});

test('create defaults to today, adds .md, and does not clobber', () => {
  const { root, content } = fixture();
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const today = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.md`;

  assert.deepEqual(
    { path: content.create().path, created: true },
    { path: today, created: true },
  );
  assert.equal(content.create().created, false);
  assert.equal(content.create('sub/idea').path, 'sub/idea.md');

  fs.writeFileSync(path.join(root, 'a.md'), 'keep\n');
  assert.equal(content.create('a.md').created, false);
  assert.equal(fs.readFileSync(path.join(root, 'a.md'), 'utf8'), 'keep\n');
  assert.throws(() => content.create('x.pdf'), PathError);
});
