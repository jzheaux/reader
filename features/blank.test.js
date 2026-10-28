import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workable, typable, unfilled } from './blank.js';

test('a page can be worked in the editor, but not on a slide or once exported', () => {
  assert.equal(workable({}), true);
  assert.equal(workable({ deck: true }), false);
  assert.equal(workable({ exported: true }), false);
});

test('a blank is a box named by its label only where the page can be worked', () => {
  assert.equal(typable('a "place"', {}), ' tabindex="0" role="textbox" aria-label="a &quot;place&quot;"');
  assert.equal(typable('Name', { deck: true }), '');
  assert.equal(typable('Name', { exported: true }), '');
});

test('an empty blank says it\'s blank only where it can\'t be filled in', () => {
  assert.equal(unfilled('', {}), '');
  assert.equal(unfilled('', { exported: true }), '<span class="field-blank">blank</span>');
  assert.equal(unfilled('', { deck: true }), '<span class="field-blank">blank</span>');
  assert.equal(unfilled('Josh', { exported: true }), '');
});
