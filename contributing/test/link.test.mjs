import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CONTRIBUTING, read, repo, scratch, settings, tree } from './setup.mjs';

const SKILLS = ['batch-start', 'retro', 'review-close', 'review-open', 'review-round'];

// A checkout holding a copy of contributing/, and a worktree of it holding another.
function checkout(t) {
  const dir = scratch(t);
  const main = path.join(dir, 'reader');
  fs.cpSync(CONTRIBUTING, path.join(main, 'contributing'), { recursive: true });
  const git = repo(main);
  // Never the real PATH's folder.
  const bin = path.join(dir, 'bin');
  const link = (from, ...args) => {
    const r = spawnSync(process.execPath, [path.join(from, 'contributing', 'link.mjs'), ...args],
      { encoding: 'utf8', env: { ...process.env, READER_BIN: bin } });
    return { status: r.status, out: r.stdout + r.stderr };
  };
  return { dir, main, git, link, bin };
}

const target = (p) => fs.realpathSync(p);

test('it links each skill into .claude/skills/ and .agents/skills/, where its scripts still find lib/', (t) => {
  const { dir, main, link } = checkout(t);
  const { status, out } = link(main);
  assert.equal(status, 0, out);
  for (const into of ['.claude/skills', '.agents/skills']) {
    assert.deepEqual(fs.readdirSync(path.join(main, into)).sort(), SKILLS);
    for (const s of SKILLS) {
      assert.ok(fs.lstatSync(path.join(main, into, s)).isSymbolicLink(), `${into}/${s}`);
      assert.equal(target(path.join(main, into, s)), target(path.join(main, 'contributing', s)));
    }
  }
  tree(dir, { 'retro.md': 'Try (Ada): carried.\n' });
  const r = spawnSync(process.execPath, [path.join(main, '.claude/skills/retro/scripts/retro-carry.mjs'), path.join(dir, 'retro.md')],
    { encoding: 'utf8', env: { ...process.env, ...settings(dir) } });
  assert.equal(r.stdout, 'Try (Ada): carried.\n', r.stderr);
});

test('run from a worktree, it links the main checkout to the worktree\'s skills', (t) => {
  // The checkout's first commit holds contributing/, so the worktree has it too.
  const { dir, main, git, link } = checkout(t);
  const tree = path.join(dir, 'tree');
  git('worktree', 'add', '-q', tree);
  assert.equal(link(tree).status, 0);
  assert.equal(target(path.join(main, '.claude/skills/retro')), target(path.join(tree, 'contributing', 'retro')));
  assert.ok(!fs.existsSync(path.join(tree, '.claude')), 'the worktree itself gets nothing');
});

test('a folder that isn\'t a link is left alone, unless --force', (t) => {
  const { main, link } = checkout(t);
  tree(main, { '.claude/skills/retro/SKILL.md': 'my own\n', '.claude/skills/mine/SKILL.md': 'another of mine\n' });
  const left = link(main);
  assert.equal(left.status, 1);
  assert.match(left.out, /^left {4}\.claude[\\/]skills[\\/]retro: a folder, not a link; --force replaces it$/m);
  assert.equal(read(main, '.claude/skills/retro/SKILL.md'), 'my own\n');

  assert.equal(link(main, '--force').status, 0);
  assert.equal(target(path.join(main, '.claude/skills/retro')), target(path.join(main, 'contributing', 'retro')));
  assert.equal(read(main, '.claude/skills/mine/SKILL.md'), 'another of mine\n', 'a skill of its own name only');
});

test('--unlink removes its links, and nothing else', (t) => {
  const { main, link } = checkout(t);
  link(main);
  tree(main, { '.claude/skills/mine/SKILL.md': 'mine\n' });
  const { status, out } = link(main, '--unlink');
  assert.equal(status, 0, out);
  assert.equal(out.trim().split('\n').length, 11);
  assert.deepEqual(fs.readdirSync(path.join(main, '.claude/skills')), ['mine']);
  assert.deepEqual(fs.readdirSync(path.join(main, '.agents/skills')), []);
  assert.ok(fs.existsSync(path.join(main, 'contributing', 'retro', 'SKILL.md')), 'what it linked to stays');
});

const READER_REVIEW = process.platform === 'win32' ? 'reader-review.cmd' : 'reader-review';

test('it puts reader-review in the bin folder, and --unlink takes it away', (t) => {
  const { main, link, bin } = checkout(t);
  const { status, out } = link(main);
  assert.equal(status, 0, out);
  const at = path.join(bin, READER_REVIEW);
  if (process.platform === 'win32') assert.match(read(at), /reader-review\.mjs" %\*/);
  else assert.equal(target(at), target(path.join(main, 'contributing', 'reader-review.mjs')));
  assert.equal(link(main, '--unlink').status, 0);
  assert.ok(!fs.existsSync(at));
});

test('a reader-review that isn\'t ours is left alone, unless --force', (t) => {
  const { main, link, bin } = checkout(t);
  tree(bin, { [READER_REVIEW]: 'mine\n' });
  const left = link(main);
  assert.equal(left.status, 1);
  assert.match(left.out, /reader-review(\.cmd)?: not one of ours; --force replaces it$/m);
  assert.equal(link(main, '--unlink').status, 0);
  assert.equal(read(bin, READER_REVIEW), 'mine\n');
  assert.equal(link(main, '--force').status, 0);
  assert.notEqual(read(bin, READER_REVIEW), 'mine\n');
});
