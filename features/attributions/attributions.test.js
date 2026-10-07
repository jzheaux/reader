import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';

test('a blockquote closing with -- gets an attribution', () => {
  const { body } = render(
    '> The road of excess\n> -- [William Blake](https://x.test)\n\n> one\n>\n> -- scripture:[Psalm 23]\n\n> a\n> -- b\n> c\n',
  );
  assert.match(body, /<p>The road of excess<\/p>\n<p class="quote-by"><a href="https:\/\/x\.test">William Blake<\/a><\/p>/);
  assert.match(body, /<p class="quote-by"><a href="https:\/\/www\.blueletterbible\.org\/rsv\/psalm\/23">Psalm 23<\/a><\/p>/);
  assert.match(body, /<p>a\n– b\nc<\/p>/);
});

test('an attribution split off a styled paragraph keeps its style; in an aside the line stays as typed', () => {
  const { body } = render('::: red georgia\n> quoted\n> -- Author\n:::\n\ntext\n\n~ > thought\n~ > -- Me\n');
  assert.match(body, /<p class="font" style="color: red; --font: 'georgia'">quoted<\/p>\n<p class="font quote-by" style="color: red; --font: 'georgia'">Author<\/p>/);
  assert.match(body, /<p><span class="gm-mark">~<\/span>-- Me<\/p>/);
});
