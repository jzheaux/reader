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

// --- the margin -----------------------------------------------------------

/** A feature, not asides, that writes a note beside the line after `!note`, and a line in the masthead. */
function noter(md) {
  md.core.ruler.push('noter', (state) => {
    const lines = state.src.split('\n');
    const at = lines.indexOf('!note');
    if (at < 0) return;
    state.env.margin = [...(state.env.margin ?? []), { anchor: at, render: (attrs) => `<div class="noted"${attrs}>noted</div>` }];
    state.env.masthead = [...(state.env.masthead ?? []), '<div class="more">more</div>'];
  });
}

test('any feature can write a note in the margin, and a line in the masthead', () => {
  const md = new MarkdownIt(options).use(page).use(noter);
  const env = {};
  const tokens = md.parse('first\n\nsecond\n!note\n\nthird\n', env);
  const html = columns(md, tokens, env).body;
  assert.match(html, /<section class="gm-pair">\n<div class="gm-speaker">\n<p>second\n!note<\/p>\n<\/div>\n<div class="gm-asides">\n<div class="noted">noted<\/div>\n<\/div>/);
  assert.match(html, /<div class="more">more<\/div>\n<\/header>/);
});

test('without asides, a page has nothing in its margin and its ~ lines are text', () => {
  const md = new MarkdownIt(options).use(page);
  const env = {};
  const html = columns(md, md.parse('a point\n\n~ a thought\n', env), env).body;
  assert.equal(env.margin, undefined);
  assert.doesNotMatch(html, /gm-asides/);
  assert.match(html, /<p>~ a thought<\/p>/);
});
