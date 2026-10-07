/**
 * The two-column layout, from gutter-md's own tests.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { asides } from '../features/asides/index.js';
import { columns } from '../src/columns.js';

const options = { html: false, linkify: true, typographer: true, breaks: false };

/** A document laid out in columns, or, with `layout: 'inline'`, its asides back in place. */
function toHtml(src, opts = {}) {
  if (opts.layout === 'inline') return new MarkdownIt(options).use(asides).render(src);
  const md = new MarkdownIt(options).use(asides, { inline: false });
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
  assert.match(html, /class="gm-mark">~</);
});

test('column headings come from front matter', () => {
  const html = toHtml('-----\nSpeaker: Dr Ellis\nListener: me\n-----\n\nhi\n\n~ ok\n');
  assert.match(html, /Dr Ellis/);
  assert.match(html, />me</);
});

test('--swap puts the listener first', () => {
  const html = toHtml('a\n\n~ b\n', { swap: true });
  const pair = html.split('<section class="gm-pair">')[1];
  assert.ok(pair.indexOf('gm-asides') < pair.indexOf('gm-speaker'));
});

test('inline layout nests asides where they were written', () => {
  const html = toHtml('* point\n  1. sub\n\n    ~ thought\n\n  2. next\n', { layout: 'inline' });
  assert.match(html, /<aside class="gm-aside">/);
  // the aside sits inside the list, and the list still has both items
  assert.match(html, /sub[\s\S]*aside[\s\S]*next/);
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
