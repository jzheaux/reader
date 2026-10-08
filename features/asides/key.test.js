/**
 * Attributed asides: who an aside is from, and what it's about, by aliases
 * declared in the front matter.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { asides } from './index.js';
import { preprocess } from './preprocess.js';
import { readEntry, makeKey, attribute } from './key.js';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';

const KEY = '-----\nreviewer #: Josh\nreviewer m: Maria, teal\ntopic c: Coherence\ntopic s: Style\n-----\n\n';

test('the key: one alias a line, with an optional colour', () => {
  assert.deepEqual(readEntry('reviewer #: Josh'), { kind: 'reviewer', alias: '#', name: 'Josh', color: null });
  assert.deepEqual(readEntry('Topic c: Coherence, #2f6aa1'), { kind: 'topic', alias: 'c', name: 'Coherence', color: '#2f6aa1' });
  assert.equal(readEntry('reviewer ~: Nope'), null);
  assert.equal(readEntry('title: A Talk'), null);
  const key = makeKey([readEntry('reviewer #: Josh'), readEntry('reviewer m: Maria, teal'), readEntry('topic c: Coherence')]);
  assert.equal(key.get('m').color, 'teal');
  // Reviewers are dealt colours from the palette's start, topics from its end.
  assert.equal(key.get('#').color, '#b5523b');
  assert.equal(key.get('c').color, '#7a5c3e');
});

test('a run of aliases: the reviewer, the topics, and any not declared', () => {
  const key = makeKey([readEntry('reviewer #: Josh'), readEntry('topic c: Coherence'), readEntry('topic s: Style')]);
  const by = attribute('c#sx', key);
  assert.equal(attribute('c#xy', key), null);
  assert.equal(by.who.name, 'Josh');
  assert.deepEqual(by.topics.map((t) => t.name), ['Coherence', 'Style']);
  assert.deepEqual(by.unknown, ['x']);
  assert.equal(attribute('xyz', key), null);
  assert.equal(attribute('#', new Map()), null);
});

test('attributed asides come out like any other, with who and what', () => {
  const { meta, asides: found, source } = preprocess(`${KEY}Some paragraph.\n\n~#c This contradicts §2.\n  and goes on.\n~m Tighten.\n`);
  assert.deepEqual(meta, {});
  assert.equal(source.trim(), 'Some paragraph.');
  assert.equal(found.length, 2);
  assert.equal(found[0].text, 'This contradicts §2.\nand goes on.');
  assert.equal(found[0].by.who.name, 'Josh');
  assert.deepEqual(found[0].by.topics.map((t) => t.name), ['Coherence']);
  assert.equal(found[1].by.who.name, 'Maria');
});

test('without a key, or with none of its aliases, `~word` is text as before', () => {
  assert.equal(preprocess('~#c not an aside\n').asides.length, 0);
  assert.equal(preprocess(`${KEY}~approximately five\n`).asides.length, 0);
  assert.equal(preprocess(`${KEY}~ plain\n`).asides[0].by, undefined);
});

test('the columns show chips, the reviewer\'s colour, and a legend', () => {
  const { body } = render(`${KEY}One.\n\n~#c Contradicts.\n\nTwo.\n\n~cx Also.\n\n~ Mine.\n`);
  assert.match(body, /<div class="gm-aside-cell gm-attributed" style="--by: #b5523b">\n<p><span class="gm-by"><span class="gm-who">Josh<\/span><span class="gm-topic" style="--topic: #7a5c3e">Coherence<\/span><\/span>Contradicts.<\/p>/);
  // A topic alone keeps the usual rule; an undeclared alias is marked.
  assert.match(body, /<div class="gm-aside-cell gm-attributed">\n<p><span class="gm-by"><span class="gm-topic"[^>]*>Coherence<\/span><span class="gm-unknown"[^>]*>x\?<\/span><\/span>Also.<\/p>/);
  assert.match(body, /<span class="gm-mark">~<\/span>Mine./);
  assert.match(body, /<div class="gm-legend"><span class="gm-who" style="--by: #b5523b">Josh <b>1<\/b><\/span><span class="gm-topic" style="--topic: #7a5c3e">Coherence <b>2<\/b><\/span><\/div>/);
  // The key isn't masthead meta.
  assert.doesNotMatch(body, /reviewer #/);
});

test('inline, an attributed aside opens with its chips', () => {
  const md = new MarkdownIt().use(asides);
  const html = md.render(`${KEY}One.\n\n~m Tighten.\n`);
  assert.match(html, /<aside class="gm-aside gm-attributed" style="--by: teal"><span class="gm-by"><span class="gm-who">Maria<\/span><\/span><p>Tighten.<\/p>/);
});

test('a deck\'s key reaches each slide', () => {
  const out = slides('---\nauthor: Josh\nreviewer #: Josh\n---\n\n# One\n\n~# Cut this.\n\n---\n\n# Two\n');
  assert.equal(out.meta.author, 'Josh');
  assert.match(out.slides[0].body, /<span class="gm-who">Josh<\/span><\/span>Cut this./);
});

test('tasks, quotes and styles read through an alias run', () => {
  const { body } = render(`${KEY}One.\n\n~# - [ ] check it\n\n::: red\nTwo.\n\n~c Inside.\n:::\n`);
  assert.match(body, /<input type="checkbox"/);
  assert.match(body, /<span class="gm-topic"[^>]*>Coherence<\/span><\/span>Inside./);
});
