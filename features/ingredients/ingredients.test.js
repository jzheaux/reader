import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { wordForms } from '../source.js';

const RECIPE = '## Akara\n\n### Ingredients\n* [ ] count:1 small yellow !onion, diced\n* [ ] fresh !cilantro\n\n### Steps\n1) [ ] Add the Onions, then [onion](x) and `onion`.\n2) [ ] More onion.\n';

test('a word is known by its plural and singular', () => {
  assert.ok(wordForms('onion').includes('onions'));
  assert.ok(wordForms('tomato').includes('tomatoes'));
  assert.ok(wordForms('beans').includes('bean'));
  assert.ok(wordForms('berry').includes('berries'));
  assert.ok(wordForms('berries').includes('berry'));
});

test('!word names an item\'s key, and the word in the recipe\'s steps is marked', () => {
  const { body } = render(RECIPE);
  assert.match(body, /<li class="ingredient task" data-ingredient="onion" data-recipe="0">.* small yellow <span class="ingredient-key">onion<\/span>, diced<\/li>/);
  assert.match(body, /Add the <span class="ingredient-use" tabindex="0" role="button" data-ingredient="onion" data-recipe="0">Onions<\/span>, then <a href="x">onion<\/a> and <code>onion<\/code>/);
  assert.match(body, /More <span class="ingredient-use"[^>]*>onion<\/span>/);
});

test('an item whose key nothing else names is flagged', () => {
  const { body } = render(RECIPE);
  assert.match(body, /<li class="ingredient ingredient-unused task" data-ingredient="cilantro" data-recipe="0" title="No step names this">/);
  assert.doesNotMatch(body, /ingredient-unused[^>]*data-ingredient="onion"/);
});

test('each recipe matches its own ingredients', () => {
  const { body } = render('## Yam\n* !water\n\nAdd water and oil.\n\n## Akara\n* !oil\n\nFry in oil, not water.\n');
  assert.match(body, /Add <span class="ingredient-use"[^>]*data-recipe="0">water<\/span> and oil\./);
  assert.match(body, /Fry in <span class="ingredient-use"[^>]*data-recipe="5">oil<\/span>, not water\./);
});

test('a multiplier\'s section is the recipe, however deep the list', () => {
  const { body } = render('# Book\n\n## Akara\nmultiplier:[]\n\n### Ingredients\n#### Batter\n* !peas\n\n### Steps\nBlend the peas.\n');
  assert.match(body, /Blend the <span class="ingredient-use"[^>]*>peas<\/span>/);
});

test('a defined term keeps its !, and \\! is as typed', () => {
  const { body } = render('!SLAB: similar layers\n\n* a !SLAB here\n* and \\!this\n\nthis and SLAB\n');
  assert.match(body, /class="def-use"/);
  assert.doesNotMatch(body, /ingredient/);
  assert.match(body, /and !this/);
});

test('an exported page\'s word isn\'t a button: it has no script to show its item with', () => {
  const { body } = render(RECIPE, { exported: true });
  assert.match(body, /Add the <span class="ingredient-use" data-ingredient="onion"/);
  assert.doesNotMatch(body, /tabindex|role="button"/);
});
