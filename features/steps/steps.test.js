import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';

test('a `1)` item with a box is a step, its badge the box', () => {
  const { body } = render('### Steps\n1) [x] Heat the oil.\n2) [ ] Add the onion.\n');
  assert.match(body, /<li class="task step step-done" data-n="1" data-steps="0"[^>]*><input type="checkbox" class="task-box" data-line="1"[^>]* checked> Heat the oil.<\/li>/);
  assert.match(body, /<li class="task step" data-n="2" data-steps="0"/);
});

test('the steps of a section go together, across a callout, and apart from the next', () => {
  const { body } = render('## Beans\n1) [ ] one\n2) [ ] two\n> [!TIP]\n> mash them\n\n7) [ ] seven\n\n## Yam\n1) [ ] one\n');
  const groups = [...body.matchAll(/data-steps="(\d+)"/g)].map((m) => m[1]);
  assert.deepEqual(groups, ['0', '0', '0', '8']);
});

test('a `1.` list, a bullet list, or a radio button or staged box is no step', () => {
  const { body } = render('1. [ ] plain\n\n- [ ] bullet\n\n1) ( ) choice\n2) [ ][ ] staged\n3) no box\n');
  assert.doesNotMatch(body, /class="[^"]*\bstep\b/);
});

test('on a slide, a step\'s box under its badge can\'t be ticked or reached', () => {
  const { body } = slides('# One\n\n1) [x] chop\n2) [ ] fry\n\n---\n\n# Next\n').slides[0];
  assert.equal(body.match(/<input type="checkbox" class="task-box"[^>]* disabled>/g).length, 2);
  assert.match(body, /class="task step step-done"/);
});

test('an exported page\'s steps have no box hidden over the badge, which says whether each is done', () => {
  const { body } = render('1) [x] chop\n2) [ ] fry\n', { exported: true });
  assert.doesNotMatch(body, /<input/);
  assert.match(body, /class="task step step-done"/);
});
