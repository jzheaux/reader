import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../src/server.js';

let server, base, root;

before(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-srv-'));
  fs.writeFileSync(path.join(root, 'note.md'), '# Note\n\n* a point\n\n~ my aside\n');
  fs.writeFileSync(path.join(root, 'page.html'), '<script>fetch("/api/tree")</script>');
  fs.writeFileSync(path.join(root, 'pic.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  fs.writeFileSync(path.join(root, 'doc.pdf'), '%PDF-1.4\n');
  ({ server } = createServer({ root }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const json = (method, url, body) =>
  fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('serves the UI and the tree', async () => {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /<textarea id="editor"/);
  const { files } = await (await fetch(base + '/api/tree')).json();
  assert.deepEqual(files.map((f) => f.path).sort(), ['doc.pdf', 'note.md']);
});

test('render puts asides in the gutter column', async () => {
  const res = await json('POST', '/api/render', { text: '* a point\n\n~ my aside\n', path: 'note.md' });
  const out = await res.json();
  assert.match(out.body, /gm-aside-cell/);
  assert.match(out.body, /my aside/);
  assert.match(out.body, /<h1 class="gm-title">note<\/h1>/);
  assert.match(out.css, /--gm-aside-col/);
  assert.equal(out.asides, 1);
  assert.equal(out.deck, false);
});

test('render says whether the text is a deck, for the Present button', async () => {
  const out = await (await json('POST', '/api/render', { text: '---\ntitle: x\n---\n\n# One\n\n---\n\n# Two\n' })).json();
  assert.equal(out.deck, true);
});

test('slides splits a deck and lifts its notes', async () => {
  const res = await json('POST', '/api/slides', { text: '# One\n\n<!-- hi -->\n\n---\n\n# Two\n', path: 'deck.md' });
  const out = await res.json();
  assert.equal(out.slides.length, 2);
  assert.equal(out.slides[0].notes, 'hi');
  assert.match(out.slides[1].body, /Two/);
});

test('save round-trips and reports conflicts as 409', async () => {
  const f = await (await fetch(base + '/api/file?path=note.md')).json();
  let res = await json('PUT', '/api/file', { path: 'note.md', text: 'edited\n', baseMtime: f.mtime });
  assert.equal(res.status, 200);
  assert.equal(fs.readFileSync(path.join(root, 'note.md'), 'utf8'), 'edited\n');

  res = await json('PUT', '/api/file', { path: 'note.md', text: 'stale\n', baseMtime: f.mtime - 1000 });
  assert.equal(res.status, 409);
});

test('refuses escapes, non-JSON writes and foreign hosts', async () => {
  let res = await fetch(base + '/api/file?path=' + encodeURIComponent('../x.md'));
  assert.equal(res.status, 400);
  res = await fetch(base + '/content/..%2F..%2Fetc%2Fpasswd');
  assert.equal(res.status, 400);
  res = await fetch(base + '/api/file', { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(res.status, 415);

  const http = await import('node:http');
  const status = await new Promise((resolve) => {
    http.get(base + '/api/tree', { headers: { Host: 'evil.example:80' } }, (r) => resolve(r.statusCode));
  });
  assert.equal(status, 403);
});

test('serves content files sandboxed, so their scripts never run as the app', async () => {
  for (const file of ['page.html', 'pic.svg', 'note.md']) {
    const res = await fetch(`${base}/content/${file}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-security-policy'), 'sandbox', file);
  }
  const pdf = await fetch(`${base}/content/doc.pdf`);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-security-policy'), null);
});

test('the preview loads a script for each kind of puzzle', async () => {
  const html = await (await fetch(base + '/preview.html')).text();
  for (const kind of ['sudoku', 'tracks', 'wordsearch', 'coord', 'maze']) {
    assert.match(html, new RegExp(`<script src="/puzzles/${kind}\\.js"></script>`));
  }
  assert.doesNotMatch(html, /<!-- puzzles -->/);
});
