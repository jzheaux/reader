import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slides, split, lift, isDeck } from '../src/slides.js';

const DECK = `---
author: Josh
paging: "Slide %d of %d"
---

# One

<!-- say hello -->

---

## Two

\`\`\`yaml
---
key: value
---
<!-- not a note -->
\`\`\`

---

<!--
  only notes,
    indented
-->
`;

test('front matter is read, and --- lines split slides', () => {
  const { meta, slides: s } = split(DECK);
  assert.deepEqual(meta, { author: 'Josh', paging: 'Slide %d of %d' });
  assert.equal(s.length, 3);
  assert.match(s[0].text, /# One/);
  assert.equal(DECK.split('\n')[s[1].line], '');
  assert.match(s[1].text, /key: value/, 'a --- inside a code fence does not split');
});

test('a leading --- that is not front matter is not swallowed', () => {
  const { meta, slides: s } = split('---\n\n# Hello there\n\nSome prose.\n\n---\n\n# Two\n');
  assert.deepEqual(meta, {});
  assert.equal(s.length, 2);
  assert.match(s[0].text, /Hello there/);
});

test('HTML comments become notes, except in code', () => {
  const { body, notes } = lift('# Hi\n\n<!-- first -->\n\ntext\n\n<!--\n  second\n    deeper\n-->\n');
  assert.doesNotMatch(body, /<!--|first|second/);
  assert.match(body, /text/);
  assert.equal(notes, 'first\n\nsecond\n  deeper');

  const code = lift('```\n<!-- kept -->\n```\n');
  assert.match(code.body, /kept/);
  assert.equal(code.notes, '');
});

test('slides renders each slide without a masthead and keeps its notes', () => {
  const out = slides(DECK, { file: 'talk/slides.md' });
  assert.equal(out.title, 'slides');
  assert.equal(out.slides.length, 3);
  assert.doesNotMatch(out.slides[0].body, /gm-masthead|gm-title/);
  assert.match(out.slides[0].body, /<h1[^>]*>One<\/h1>/);
  assert.equal(out.slides[0].notes, 'say hello');
  // Still in the fence, as highlighted code.
  assert.match(out.slides[1].body.replace(/<\/?span[^>]*>/g, ''), /&lt;!-- not a note --&gt;/);
  assert.equal(out.slides[1].notes, '');
  assert.equal(out.slides[2].notes, 'only notes,\n  indented');
  assert.match(out.css, /--gm-base: clamp/);
});

test('isDeck needs a break after the front matter', () => {
  assert.equal(isDeck(DECK), true);
  assert.equal(isDeck('---\ntitle: x\n---\n\n# just a note\n'), false);
  assert.equal(isDeck('# a note\n\nwith prose\n'), false);
});

test('puzzles are numbered across the whole deck', () => {
  const out = slides('```sudoku\n.\n```\n\n---\n\n# Two\n\n```sudoku\n.\n```\n');
  assert.match(out.slides[0].body, /data-puzzle="0"/);
  assert.match(out.slides[1].body, /data-puzzle="1"/);
});

test('notes leave their lines behind, so a slide knows its lines in the file', () => {
  const { body } = lift('# Hi\n\n<!--\n  a note\n-->\n\n- [ ] task\n');
  assert.equal(body.split('\n').length, 8);
  assert.equal(body.split('\n')[6], '- [ ] task');

  const out = slides('# One\n\n---\n\n# Two\n\n<!--\n  a note\n-->\n\n- [ ] task\n@ Name: x\n');
  assert.match(out.slides[1].body, /class="task-box" data-line="10"/);
  assert.match(out.slides[1].body, /class="field" data-line="11"/);
});

test('blank lines in a slide\'s code are kept', () => {
  const { body } = lift('```\na\n\n\n\nb\n```\n');
  assert.match(body, /a\n\n\n\nb/);
});
