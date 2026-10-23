import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, parseHead, version } from '../src/version.js';

const SHA = 'c53a7184fca327599fa5a3eac129ade1f18b13b9';

test('a release is its tag, linked to its notes', () => {
  assert.deepEqual(describe('0.0.2', null), {
    label: 'v0.0.2', url: 'https://github.com/jzheaux/reader/releases/tag/v0.0.2',
  });
  assert.deepEqual(describe('0.0.2', { commit: SHA, tags: ['v0.0.1', 'v0.0.2'] }), describe('0.0.2', null));
});

test('a checkout past its release says which commit, and links to it', () => {
  assert.deepEqual(describe('0.0.2', { commit: SHA, tags: ['v0.0.1'] }), {
    label: 'v0.0.2+c53a718', url: `https://github.com/jzheaux/reader/commit/${SHA}`,
  });
});

test("the head is read for its commit and tags, and anything else for nothing", () => {
  assert.deepEqual(parseHead(`${SHA}\nHEAD -> main, tag: v0.0.2, origin/main, tag: latest`), { commit: SHA, tags: ['v0.0.2', 'latest'] });
  assert.deepEqual(parseHead(SHA), { commit: SHA, tags: [] });
  assert.equal(parseHead(''), null);
  assert.equal(parseHead('fatal: not a repository'), null);
});

test("the version is package.json's", () => {
  const { version: v } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const { label } = version();
  assert.match(label, /^v[^+]+(\+[0-9a-f]{7})?$/);
  assert.equal(label.split('+')[0], `v${v}`);
});
