/**
 * The asides feature, from gutter-md's own tests: front matter, telling an
 * aside from what isn't one, leaving the document's shape alone, and where
 * each aside goes, back inline or into the columns.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { asides } from './index.js';
import { preprocess } from './preprocess.js';
import { splitPairs } from './split.js';

/** A document parsed for columns: its front matter, asides, and the rows they cut it into. */
function parse(src) {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: false }).use(asides, { inline: false });
  const env = {};
  const tokens = md.parse(src, env);
  const found = env.asides || [];
  return { meta: env.frontMatter || {}, asides: found, pairs: splitPairs(tokens, found), md, env, tokens };
}

const speakerText = (pair, md, env) =>
  md.renderer.render(pair.speaker, md.options, env).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// --- front matter ---------------------------------------------------------

test('reads ----- front matter', () => {
  const { meta, source } = preprocess('-----\nTitle: A Talk\nAuthor: jz\nTags: spec\n-----\n\nbody\n');
  assert.equal(meta.title, 'A Talk');
  assert.equal(meta.author, 'jz');
  assert.equal(meta.tags, 'spec');
  assert.equal(source.trim(), 'body');
});

test('reads --- front matter too', () => {
  const { meta } = preprocess('---\nTitle: B\n---\n\nbody\n');
  assert.equal(meta.title, 'B');
});

test('a leading rule that is not front matter is left alone', () => {
  const { meta, source } = preprocess('---\n\nbody\n');
  assert.deepEqual(meta, {});
  assert.match(source, /^---/);
});

// --- recognising asides ---------------------------------------------------

test('lifts asides out of the source', () => {
  const { source, asides } = preprocess('a line\n\n~ a thought\n\nanother line\n');
  assert.equal(asides.length, 1);
  assert.equal(asides[0].text, 'a thought');
  assert.doesNotMatch(source, /thought/);
});

test('a bare ~ is an aside; ~~strike~~ and ~~~ fences are not', () => {
  assert.equal(preprocess('~\n').asides.length, 1);
  assert.equal(preprocess('~~struck~~\n').asides.length, 0);
  assert.equal(preprocess('~~~\ncode\n~~~\n').asides.length, 0);
});

test('tildes inside fenced code are left in the code', () => {
  const src = 'text\n\n```js\n~ not an aside\n```\n';
  const { asides, source } = preprocess(src);
  assert.equal(asides.length, 0);
  assert.match(source, /~ not an aside/);
});

test('a wrapped line continues the same thought', () => {
  const { asides } = preprocess('a\n\n~ first line\n  second line\n\nb\n');
  assert.equal(asides.length, 1);
  assert.equal(asides[0].text, 'first line\nsecond line');
});

test('consecutive ~ lines are separate thoughts sharing an anchor', () => {
  const { asides } = preprocess('a\n\n~ one\n~ two\n\nb\n');
  assert.equal(asides.length, 2);
  assert.deepEqual(asides.map((a) => a.text), ['one', 'two']);
  assert.equal(asides[0].anchor, asides[1].anchor);
});

test('an aside does not swallow the block that follows it', () => {
  const { asides, source } = preprocess('a\n\n~ thought\n* a bullet\n');
  assert.equal(asides.length, 1);
  assert.equal(asides[0].text, 'thought');
  assert.match(source, /^\* a bullet$/m);
});

// --- structural transparency: the whole point -----------------------------

/** The parsed shape of the speaker's document, before any column splitting. */
function speakerShape(src) {
  return parse(src).tokens.map((t) => t.type).join(' ');
}

test('an aside at column 0 does not break the list it sits inside', () => {
  // Plain markdown would end the bullet here and orphan the sub-list.
  const withAside = '* a point\n\n~ my thought\n\n   1. sub one\n   2. sub two\n';
  const { pairs, md, env } = parse(withAside);
  const html = pairs.map((p) => md.renderer.render(p.speaker, md.options, env)).join('');
  // the sub-list is still inside a list item, not a sibling of the bullet list
  assert.match(html, /<li[^>]*>[\s\S]*<ol[\s\S]*sub one/);
  assert.deepEqual(renderedNumbering(withAside), [1, 2]);
});

test('removing every aside yields the same structure as never writing one', () => {
  const withAside = '* a point\n  1. sub one\n\n    ~ thought\n\n  2. sub two\n';
  const without = '* a point\n  1. sub one\n  2. sub two\n';
  assert.equal(speakerShape(withAside), speakerShape(without));
});

// --- anchoring ------------------------------------------------------------

test('an aside aligns with the line it was written after', () => {
  const src = '1. alpha\n2. bravo\n\n   ~ about bravo\n\n3. charlie\n';
  const { pairs, md, env } = parse(src);
  const withAside = pairs.find((p) => p.asides.length);
  assert.equal(withAside.asides[0].text, 'about bravo');
  assert.match(speakerText(withAside, md, env), /^bravo/);
});

/** The numbers a reader would actually see, in order, across every chunk. */
function renderedNumbering(src) {
  const { pairs, md, env } = parse(src);
  const html = pairs.map((p) => md.renderer.render(p.speaker, md.options, env)).join('');
  const seen = [];
  for (const list of html.split(/<ol/).slice(1)) {
    let n = Number(/^[^>]*\bstart="(\d+)"/.exec(list)?.[1] ?? 1);
    for (const item of list.split('</ol>')[0].split(/<li/).slice(1)) {
      const v = /^[^>]*\bvalue="(\d+)"/.exec(item);
      if (v) n = Number(v[1]);
      seen.push(n++);
    }
  }
  return seen;
}

test('list numbering is unbroken across a cut', () => {
  assert.deepEqual(
    renderedNumbering('1. alpha\n2. bravo\n\n   ~ note\n\n3. charlie\n4. delta\n'),
    [1, 2, 3, 4]
  );
});

test('numbering is unbroken when the aside falls mid-list twice', () => {
  const src = '1. a\n\n   ~ one\n\n2. b\n3. c\n\n   ~ two\n\n4. d\n5. e\n';
  assert.deepEqual(renderedNumbering(src), [1, 2, 3, 4, 5]);
});

test('no item is duplicated or dropped across a cut', () => {
  const src = '1. alpha\n2. bravo\n\n   ~ note\n\n3. charlie\n';
  const { pairs, md, env } = parse(src);
  const html = pairs.map((p) => md.renderer.render(p.speaker, md.options, env)).join('');
  for (const word of ['alpha', 'bravo', 'charlie']) {
    assert.equal((html.match(new RegExp(word, 'g')) || []).length, 1, word);
  }
});

test('cutting mid-item resumes that item without a second marker', () => {
  const src = '* a bullet with\n\n  more prose\n\n  ~ note\n\n  and a tail\n';
  const { pairs, md, env } = parse(src);
  const html = pairs.map((p) => md.renderer.render(p.speaker, md.options, env)).join('');
  assert.match(html, /gm-cont/);
  assert.match(html, /and a tail/);
});

test('what the speaker said next starts below the aside, not beside it', () => {
  const src = '1. alpha\n2. bravo\n\n   ~ a long thought about bravo\n\n3. charlie\n';
  const { pairs, md, env } = parse(src);
  const row = pairs.find((p) => p.asides.length);
  // The commented item owns its row; charlie is not carried along beside it.
  assert.match(speakerText(row, md, env), /^bravo$/);
});

test('the item after a commented one starts a fresh row either way', () => {
  // Uncommented items may share a row -- nothing separates them. What must not
  // vary is where the item *following* a commented one begins: it always opens
  // a new row under the aside, whether or not it carries a comment of its own.
  const check = (src) => {
    const { pairs, md, env } = parse(src);
    const i = pairs.findIndex((p) => p.asides.some((a) => a.text === 'note'));
    assert.match(speakerText(pairs[i], md, env), /^b$/);
    assert.match(speakerText(pairs[i + 1], md, env), /^c/);
  };
  check('1. a\n2. b\n\n   ~ note\n\n3. c\n\n4. d\n');
  check('1. a\n2. b\n\n   ~ note\n\n3. c\n\n   ~ another\n\n4. d\n');
});

test('several asides on one line share a cell', () => {
  const { pairs } = parse('a point\n\n~ one\n~ two\n');
  const cell = pairs.find((p) => p.asides.length);
  assert.equal(cell.asides.length, 2);
});

test('an aside before any content does not crash', () => {
  const { pairs } = parse('~ thought first\n\nthen speech\n');
  assert.ok(pairs.some((p) => p.asides.length));
});

test('a document with no asides is a single pair', () => {
  const { pairs } = parse('just speech\n\nmore speech\n');
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].asides.length, 0);
});

// --- front matter pass-through --------------------------------------------

test('matter is the front matter block exactly as written', () => {
  const src = '-----\nTitle: A Talk\nAuthor: jz\n-----\n\nbody\n';
  const { matter } = preprocess(src);
  assert.equal(matter, '-----\nTitle: A Talk\nAuthor: jz\n-----');
});

test('matter is empty when there is no front matter', () => {
  assert.equal(preprocess('body\n').matter, '');
});
