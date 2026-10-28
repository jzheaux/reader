import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES, checkRequires } from './index.js';

test('each feature in the list has the features it requires before it', () => {
  assert.equal(checkRequires(FEATURES), FEATURES);
  assert.deepEqual(FEATURES.find((f) => f.name === 'steps').requires, ['tasks', 'badges']);
});

test('a list without a feature another requires fails, naming both', () => {
  const without = FEATURES.filter((f) => f.name !== 'badges');
  assert.throws(() => checkRequires(without), { message: 'The steps feature requires badges, which isn\'t in the list of features' });
});

test('a list with a required feature after the one requiring it fails, naming both', () => {
  const base = { name: 'base' };
  const built = { name: 'built', requires: ['base'] };
  assert.deepEqual(checkRequires([base, built]), [base, built]);
  assert.throws(() => checkRequires([built, base]), { message: 'The built feature requires base, which has to come before it in the list of features' });
});

test('a raw feature comes before the rest, wherever it is in the list, as tasks does before steps', () => {
  const base = { name: 'base', raw: true };
  const built = { name: 'built', requires: ['base'] };
  assert.deepEqual(checkRequires([built, base]), [built, base]);
  assert.throws(() => checkRequires([{ name: 'built', raw: true, requires: ['base'] }, { name: 'base' }]), /built feature requires base/);
});

test('a feature with only a late plugin comes after the rest, wherever it is in the list; one with a plugin too goes by its plugin', () => {
  const late = () => {};
  const base = { name: 'base' };
  const built = { name: 'built', late, requires: ['base'] };
  assert.deepEqual(checkRequires([built, base]), [built, base]);
  assert.throws(() => checkRequires([{ name: 'built', requires: ['base'] }, { name: 'base', late }]), /built feature requires base, which has to come before it/);
  // as asides does, raw and late, before the rest
  const both = [{ name: 'base', raw: true, plugin: late, late }, { name: 'built', requires: ['base'] }];
  assert.equal(checkRequires(both), both);
  assert.equal(checkRequires([...both].reverse()).length, 2);
});
