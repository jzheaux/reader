import { test } from 'node:test';
import assert from 'node:assert/strict';
import { next, back, nextWhole, backWhole } from '../static/app/moves.js';

// Three slides: two steps, none (a title slide), three.
const steps = [2, 0, 3];
const at = (index, reveal) => ({ index, reveal });

test('n shows one more step, then goes on to the next slide with none showing', () => {
  assert.deepEqual(next(steps, at(0, 0)), at(0, 1));
  assert.deepEqual(next(steps, at(0, 1)), at(0, 2));
  assert.deepEqual(next(steps, at(0, 2)), at(1, 0));
  assert.deepEqual(next(steps, at(1, 0)), at(2, 0));
});

test('p takes back one step, then goes to the previous slide with all of it showing', () => {
  assert.deepEqual(back(steps, at(2, 2)), at(2, 1));
  assert.deepEqual(back(steps, at(2, 0)), at(1, 0));
  assert.deepEqual(back(steps, at(1, 0)), at(0, 2));
});

test('n and p undo each other', () => {
  for (let index = 0; index < steps.length; index++) {
    for (let reveal = 0; reveal <= steps[index]; reveal++) {
      const here = at(index, reveal);
      const last = index === steps.length - 1 && reveal === steps[index];
      const first = index === 0 && reveal === 0;
      if (!last) assert.deepEqual(back(steps, next(steps, here)), here);
      if (!first) assert.deepEqual(next(steps, back(steps, here)), here);
    }
  }
});

test('N shows the rest of the slide, or the next slide whole', () => {
  assert.deepEqual(nextWhole(steps, at(0, 0)), at(0, 2));
  assert.deepEqual(nextWhole(steps, at(0, 1)), at(0, 2));
  assert.deepEqual(nextWhole(steps, at(0, 2)), at(1, 0));
  assert.deepEqual(nextWhole(steps, at(1, 0)), at(2, 3));
});

test('P goes to the start of the slide, or to the start of the previous one', () => {
  assert.deepEqual(backWhole(steps, at(2, 3)), at(2, 0));
  assert.deepEqual(backWhole(steps, at(2, 1)), at(2, 0));
  assert.deepEqual(backWhole(steps, at(2, 0)), at(1, 0));
  assert.deepEqual(backWhole(steps, at(1, 0)), at(0, 0));
});

test('stays put at either end of the deck', () => {
  assert.deepEqual(next(steps, at(2, 3)), at(2, 3));
  assert.deepEqual(nextWhole(steps, at(2, 3)), at(2, 3));
  assert.deepEqual(back(steps, at(0, 0)), at(0, 0));
  assert.deepEqual(backWhole(steps, at(0, 0)), at(0, 0));
});
