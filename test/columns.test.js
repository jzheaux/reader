/**
 * The two-column layout, from gutter-md's own tests.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { asides } from '../features/asides/index.js';
import { columns } from '../src/columns.js';
import { page } from '../src/page.js';

const options = { html: false, linkify: true, typographer: true, breaks: false };

/** A document laid out in columns. */
function toHtml(src, opts = {}) {
  const md = new MarkdownIt(options).use(page).use(asides);
  const env = {};
  const tokens = md.parse(src, env);
  return columns(md, tokens, env, opts).body;
}

// --- rendering ------------------------------------------------------------

test('column layout emits paired cells and the tilde mark', () => {
  const html = toHtml('a point\n\n~ a thought\n');
  assert.match(html, /gm-pair/);
  assert.match(html, /gm-speaker/);
  assert.match(html, /gm-aside-cell/);
  assert.match(html, /class="gm-mark" aria-hidden="true">~</);
});

test('column headings come from front matter', () => {
  const html = toHtml('-----\nSpeaker: Dr Ellis\nListener: me\n-----\n\nhi\n\n~ ok\n');
  assert.match(html, /Dr Ellis/);
  assert.match(html, />me</);
});

test('aside bodies are markdown', () => {
  const html = toHtml('a\n\n~ a **bold** thought with `code`\n');
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<code>code<\/code>/);
});

test('html is escaped, not injected', () => {
  const html = toHtml('-----\nTitle: <script>x</script>\n-----\n\nhi\n');
  assert.doesNotMatch(html, /<title><script>/);
  assert.match(html, /&lt;script&gt;/);
});
