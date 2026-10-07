import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';

test('task items become checkboxes that know their line', () => {
  const { body } = render('# todo\n\n- [ ] take out the trash\n- [x] dishes\n\n1. [X] done\n');
  assert.match(body, /<li class="task"><input type="checkbox" class="task-box" data-line="2" [^>]*> take out the trash<\/li>/);
  assert.match(body, /<li class="task"><input type="checkbox" class="task-box" data-line="3" [^>]* checked> dishes<\/li>/);
  assert.match(body, /data-line="5" [^>]* checked> done/);
});

test('a task box knows its line checked and unchecked, as written', () => {
  const { body } = render('- [ ] trash\n- [X] dishes\n- ( ) red\n');
  assert.match(body, /data-line="0" data-on="- \[x\] trash" data-off="- \[ \] trash">/);
  assert.match(body, /data-line="1" data-on="- \[X\] dishes" data-off="- \[ \] dishes" checked>/);
  assert.match(body, /data-line="2" data-on="- \(x\) red" data-off="- \( \) red">/);
});

test('choice items become radio buttons, one group to a list', () => {
  const { body } = render('- ( ) red\n- (x) blue\n  - ( ) navy\n  - ( ) sky\n- ( ) green\n\ntext\n\n- ( ) yes\n- ( ) no\n');
  assert.match(body, /<li class="task"><input type="radio" class="choice-box" name="choice-1" data-line="0" [^>]*> red<\/li>/);
  assert.match(body, /name="choice-1" data-line="1" [^>]* checked> blue/);
  assert.match(body, /name="choice-2" data-line="2" [^>]*> navy/);
  assert.match(body, /name="choice-2" data-line="3" [^>]*> sky/);
  assert.match(body, /name="choice-1" data-line="4" [^>]*> green/);
  assert.match(body, /name="choice-3" data-line="8" [^>]*> yes/);
  assert.match(body, /name="choice-3" data-line="9" [^>]*> no/);
});

test('choice boxes not heading a list item are left as typed', () => {
  const { body } = render('```\n- ( ) fenced\n```\n\na ( ) b\n\n- ( )x\n');
  assert.doesNotMatch(body, /radio/);
  assert.match(body, /- \( \) fenced/);
  assert.match(body, /a \( \) b/);
});

test('task boxes in code, or not heading a list item, are left as typed', () => {
  const { body } = render('```\n- [ ] fenced\n```\n\nText\n\n    - [ ] indented\n\na [ ] b\n\n- [ ]x\n');
  assert.doesNotMatch(body, /checkbox/);
  assert.match(body, /- \[ \] fenced/);
  assert.match(body, /- \[ \] indented/);
  assert.match(body, /a \[ \] b/);
  assert.doesNotMatch(body, /[\uE000\uE001]/);
});

test('a box in an aside knows its line in the file', () => {
  const { body } = render('text\n~ - [ ] in the aside\n', { line: 10 });
  assert.match(body, /<li class="task"><input type="checkbox" class="task-box" data-line="11" data-on="~ - \[x\] in the aside" data-off="~ - \[ \] in the aside"> in the aside<\/li>/);
});

test('a list of radio buttons split by an aside is still one choice', () => {
  const { body } = render('- ( ) red\n~ a thought\n- (x) blue\n');
  const names = [...body.matchAll(/class="choice-box" name="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(names.length, 2);
  assert.equal(names[0], names[1]);
});

test('boxes on a slide know their lines in the file', () => {
  const out = slides('# One\n\n---\n\n- [ ] here\n');
  assert.match(out.slides[1].body, /data-line="4" data-on="- \[x\] here"/);
});

test('the stylesheet comes with the feature', () => {
  assert.match(render('- [ ] x\n').css, /li\.task \{ list-style: none; \}/);
});
