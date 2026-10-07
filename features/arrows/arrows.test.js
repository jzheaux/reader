import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';

const text = (src) => {
  const { body } = render(src);
  return body.slice(body.indexOf('<div class="gm-speaker">'), body.indexOf('</section>'));
};

test('arrows, but not in code, comments or when escaped', () => {
  assert.match(text('a -> b <- c <-> d\n'), /a \u2192 b \u2190 c \u2194 d/);
  assert.match(text('`a -> b`\n'), /<code>a -&gt; b<\/code>/);
  assert.match(text('```\n->\n```\n'), /<code>-&gt;\n<\/code>/);
  assert.match(text('<!-- x -->\n'), /&lt;!-- x --&gt;/);
  assert.match(text('\\-> and \\<-\n'), /-&gt; and &lt;-/);
  assert.match(text('a => b <= c\n'), /a =&gt; b &lt;= c/);
});

test('a search keeps the arrow it was asked for; its label shows the arrow', () => {
  assert.match(text('search:[a -> b]\n'), /href="https:\/\/www\.google\.com\/search\?q=a\+-%3E\+b">a \u2192 b<\/a>/);
});

test('a link keeps its address as typed', () => {
  assert.match(text('[a -> b](https://x.test/a->b)\n'), /<a href="https:\/\/x\.test\/a-%3Eb">a \u2192 b<\/a>/);
});

test("an image's alt text shows arrows too", () => {
  assert.match(text('![a -> b](i.png)\n'), /alt="a \u2192 b"/);
});
