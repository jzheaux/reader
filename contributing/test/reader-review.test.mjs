import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CONTRIBUTING, repo, scratch, tree } from './setup.mjs';

// A checkout holding contributing/ and a dev.js that says what it was given, with
// worktrees for two review branches and an issue.
function checkout(t, branches = ['review/2026.11.20', 'review/2026.11.23', 'issue/gh-320']) {
  const dir = scratch(t);
  const main = path.join(dir, 'reader');
  fs.cpSync(CONTRIBUTING, path.join(main, 'contributing'), { recursive: true });
  const dev = 'console.log(JSON.stringify({ from: import.meta.url, cwd: process.cwd(), args: process.argv.slice(2) }));\n';
  tree(main, { 'scripts/dev.js': dev });
  const git = repo(main);
  fs.mkdirSync(path.join(main, 'node_modules'));
  const at = {};
  for (const b of branches) {
    at[b] = path.join(main, '.claude', 'worktrees', b.replace('/', '-'));
    git('worktree', 'add', '-q', '-b', b, at[b]);
    fs.mkdirSync(path.join(at[b], 'node_modules'));
  }
  const run = (args, cwd = dir) => {
    const r = spawnSync(process.execPath, [path.join(main, 'contributing', 'reader-review.mjs'), ...args], { cwd, encoding: 'utf8' });
    return { status: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) };
  };
  return { dir, main, at, run };
}

const real = (p) => fs.realpathSync(p);

test('it runs the newest review worktree\'s dev.js, from where it\'s run, with reader\'s options', (t) => {
  const { dir, at, run } = checkout(t);
  const r = run(['notes', '--port', '9000']);
  assert.equal(r.status, 0, r.err);
  assert.match(r.err, /^reader-review: review\/2026\.11\.23, in /);
  const { from, cwd, args } = r.json();
  assert.equal(real(fileURLToPath(from)), real(path.join(at['review/2026.11.23'], 'scripts', 'dev.js')));
  assert.equal(real(cwd), real(dir));
  assert.deepEqual(args, ['notes', '--port', '9000']);
});

test('--at runs another branch\'s worktree, and names them all when it isn\'t checked out', (t) => {
  const { run } = checkout(t);
  assert.match(run(['--at', 'issue/gh-320', '--which']).err, /^reader-review: issue\/gh-320, in .*issue-gh-320$/m);
  assert.match(run(['--at=main', '--which']).err, /^reader-review: main, in /m);
  const r = run(['--at', 'review/2026.01.01', '.']);
  assert.equal(r.status, 1);
  assert.match(r.err, /review\/2026\.01\.01 isn't checked out in any worktree; these are: issue\/gh-320, main, review\/2026\.11\.20, review\/2026\.11\.23/);
});

test('with no review worktree, it runs main', (t) => {
  const { main, run } = checkout(t, []);
  const r = run(['.']);
  assert.equal(r.status, 0, r.err);
  assert.match(r.err, /^reader-review: main, in /);
  assert.equal(real(fileURLToPath(r.json().from)), real(path.join(main, 'scripts', 'dev.js')));
});

test('a worktree with no node_modules says how to install them', (t) => {
  const { at, run } = checkout(t);
  fs.rmdirSync(path.join(at['review/2026.11.23'], 'node_modules'));
  const r = run(['.']);
  assert.equal(r.status, 1);
  assert.match(r.err, /no node_modules there yet: npm --prefix .*review-2026\.11\.23 install/);
});
