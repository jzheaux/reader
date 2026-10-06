import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEdits, toLines } from '../static/edits.js';

const apply = (text, edits) => {
  const c = applyEdits(text, edits);
  return c && text.slice(0, c.start) + c.text + text.slice(c.end);
};

test('replaces lines that still say what they said', () => {
  const text = '# todo\n- [ ] trash\n- [ ] dishes\n';
  assert.equal(apply(text, [{ from: 1, to: 2, before: ['- [ ] trash'], after: ['- [x] trash'] }]),
    '# todo\n- [x] trash\n- [ ] dishes\n');
});

test('reports only the stretch that changes', () => {
  const c = applyEdits('a\n- [ ] b\nc', [{ from: 1, to: 2, before: ['- [ ] b'], after: ['- [x] b'] }]);
  assert.deepEqual(c, { start: 5, end: 6, text: 'x' });
});

test('refuses lines that have changed since', () => {
  const text = '- [ ] trash\n';
  assert.equal(applyEdits(text, [{ from: 0, to: 1, before: ['- [ ] dishes'], after: ['- [x] dishes'] }]), null);
  assert.equal(applyEdits(text, [{ from: 5, to: 6, before: [''], after: ['x'] }]), null);
});

test('makes several edits as one, and refuses them all if one is stale', () => {
  const text = '- ( ) red\n- (x) blue\n- ( ) green';
  const edits = [
    { from: 0, to: 1, before: ['- ( ) red'], after: ['- (x) red'] },
    { from: 1, to: 2, before: ['- (x) blue'], after: ['- ( ) blue'] },
  ];
  assert.equal(apply(text, edits), '- (x) red\n- ( ) blue\n- ( ) green');
  assert.equal(applyEdits(text, [...edits, { from: 2, to: 3, before: ['- (x) green'], after: [] }]), null);
});

test('refuses overlapping or malformed edits', () => {
  const text = 'a\nb\nc';
  assert.equal(applyEdits(text, [
    { from: 0, to: 2, before: ['a', 'b'], after: [] },
    { from: 1, to: 2, before: ['b'], after: [] },
  ]), null);
  assert.equal(applyEdits(text, [{ from: 0, to: 1, before: ['a'], after: ['x\ny'] }]), null);
  assert.equal(applyEdits(text, [{ from: '0', to: 1, before: ['a'], after: [] }]), null);
  assert.equal(applyEdits(text, []), null);
});

test('grows, shrinks, empties and fills a fence', () => {
  const text = '```maze\npath: R\n```\nafter';
  assert.equal(apply(text, [{ from: 1, to: 2, before: ['path: R'], after: ['path: R D', 'notes: r1c1'] }]),
    '```maze\npath: R D\nnotes: r1c1\n```\nafter');
  assert.equal(apply(text, [{ from: 1, to: 2, before: ['path: R'], after: [] }]), '```maze\n```\nafter');
  assert.equal(apply('```maze\n```', [{ from: 1, to: 1, before: [], after: ['path: D'] }]), '```maze\npath: D\n```');
});

test('an empty block is no lines', () => {
  assert.deepEqual(toLines(''), []);
  assert.deepEqual(toLines('a\nb'), ['a', 'b']);
});
