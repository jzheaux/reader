import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { page, preview, run, settle } from '../../test/dom.js';

const RECIPE = [
  '---', 'multibox:', '  stages: have, prepped, used', '---', '',
  '## Akara', '',
  '### Ingredients',
  '* [x][ ][ ] count:1 small yellow !onion, diced',
  '* [ ] a handful of fresh !cilantro, chopped',
  '* [ ] count:2 cups !peas',
  '',
  '### Steps',
  '1) [ ] Fry the onion.',
  '2) [ ] Add the cilantro and the onion.',
].join('\n');

/** Ticks step `n` of RECIPE, as shown: what it asked to be written by the end of the turn, as lines [from, after]. */
async function ticking(p, n) {
  p.posted.length = 0;
  p.document.querySelectorAll('li.step > .task-box')[n - 1].click();
  await settle();
  return p.posted.filter((m) => m.type === 'edit').map((m) => m.edits.map((e) => [e.from, e.after[0]]));
}

test('an ingredient isn\'t used until the last step that names it is done', async () => {
  const p = preview();
  p.show(render(RECIPE).body);
  assert.deepEqual(await ticking(p, 1), [[[13, '1) [x] Fry the onion.']]]);
  assert.equal(p.document.querySelector('.stage-box').dataset.stage, '1');
});

test('the last step to name an ingredient marks it used in the same edit: a staged box filled, a plain one ticked', async () => {
  const p = preview();
  p.show(render(RECIPE).body);
  await ticking(p, 1);
  assert.deepEqual(await ticking(p, 2), [[
    [14, '2) [x] Add the cilantro and the onion.'],
    [9, '* [x] a handful of fresh !cilantro, chopped'],
    [8, '* [x][x][x] count:1 small yellow !onion, diced'],
  ]]);
  const [staged] = p.document.querySelectorAll('.stage-box');
  const [cilantro, peas] = p.document.querySelectorAll('li.ingredient .task-box');
  assert.equal(staged.dataset.stage, '3');
  assert.deepEqual([cilantro.checked, peas.checked], [true, false]);
});

test('a step done out of order leaves what a step still to do names', async () => {
  const p = preview();
  p.show(render(RECIPE).body);
  assert.deepEqual(await ticking(p, 2), [[
    [14, '2) [x] Add the cilantro and the onion.'],
    [9, '* [x] a handful of fresh !cilantro, chopped'],
  ]]);
});

test('any list item ticked uses up what it last names, not only a step', async () => {
  const p = preview();
  p.show(render(RECIPE.replace('2) [ ] Add the cilantro and the onion.', '* [ ] Add the cilantro and the onion.')).body);
  await ticking(p, 1);
  p.posted.length = 0;
  p.document.querySelector('li.task:not(.step):not(.ingredient) > .task-box').click();
  await settle();
  assert.deepEqual(p.posted.filter((m) => m.type === 'edit').map((m) => m.edits.map((e) => [e.from, e.after[0]])), [[
    [14, '* [x] Add the cilantro and the onion.'],
    [9, '* [x] a handful of fresh !cilantro, chopped'],
    [8, '* [x][x][x] count:1 small yellow !onion, diced'],
  ]]);
});

test('what\'s current on the page lights the ingredients it names, and their items, with no steps feature to say so', () => {
  const window = run(page(render(RECIPE).body), 'static/preview-api.js', 'features/ingredients/preview.js');
  const { document } = window;
  const lit = () => [...document.querySelectorAll('.lit')].map((n) => n.matches('li.ingredient') ? `item ${n.dataset.ingredient}` : n.textContent.trim());
  const current = (li) => {
    for (const n of document.querySelectorAll('[aria-current]')) n.removeAttribute('aria-current');
    li?.setAttribute('aria-current', 'step');
    document.dispatchEvent(new window.Event('preview:current'));
  };
  const [, second] = document.querySelectorAll('ol > li');
  current(second);
  assert.deepEqual(lit().sort(), ['cilantro', 'item cilantro', 'item onion', 'onion']);
  current(null);
  assert.deepEqual(lit(), []);
});

test('a step clicked lights what it names', () => {
  const p = preview();
  p.show(render(RECIPE).body);
  p.document.querySelectorAll('li.step')[1].click();
  const lit = [...p.document.querySelectorAll('li.ingredient.lit')].map((li) => li.dataset.ingredient);
  assert.deepEqual(lit.sort(), ['cilantro', 'onion']);
  assert.equal(p.document.querySelectorAll('.ingredient-use.lit').length, 2);
});

test('the word is a button that shows its item, described by it, and Enter puts it away', () => {
  const p = preview();
  p.show(render(RECIPE).body);
  const use = p.document.querySelector('.ingredient-use');
  const pop = () => p.document.querySelector('.ingredient-pop');
  assert.equal(use.getAttribute('role'), 'button');
  use.focus();
  assert.equal(pop().hidden, false);
  assert.equal(use.getAttribute('aria-describedby'), pop().id);
  assert.match(pop().textContent, /small yellow onion/);
  const press = (key) => use.dispatchEvent(new p.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  press('Enter');
  assert.equal(pop().hidden, true);
  assert.equal(use.hasAttribute('aria-describedby'), false);
  press(' ');
  assert.equal(pop().hidden, false);
});

test('the item stays up while the pointer moves from the word onto it', () => {
  const p = preview();
  p.show(render(RECIPE).body);
  const over = (n) => n.dispatchEvent(new p.window.MouseEvent('mouseover', { bubbles: true }));
  over(p.document.querySelector('.ingredient-use'));
  const pop = p.document.querySelector('.ingredient-pop');
  over(pop);
  assert.equal(pop.hidden, false);
  over(p.document.querySelector('h2'));
  assert.equal(pop.hidden, true);
});
