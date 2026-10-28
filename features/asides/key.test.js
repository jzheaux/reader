/**
 * Attributed asides: who an aside is from, and what it's about, by aliases
 * declared in the front matter.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { preprocess as asidesOf } from './preprocess.js';
import { readEntry, makeKey, attribute } from './key.js';
import { inFamily, ownColor } from '../color.js';
import { extract } from '../../src/page.js';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';

/** `src` as the feature sees it: its front matter off, and the key it declares. */
function preprocess(src) {
  const { meta, entries, source } = extract(src);
  return { meta, ...asidesOf(source, makeKey(entries.filter((e) => e.feature === 'asides'))) };
}

const KEY = '-----\nreviewer #: Josh\nreviewer m: Maria, teal\ntopic c: Coherence\ntopic s: Style\n-----\n\n';

test('the key: one alias a line, with an optional colour', () => {
  assert.deepEqual(readEntry('reviewer #: Josh'), { kind: 'reviewer', alias: '#', name: 'Josh', color: null, style: null });
  assert.deepEqual(readEntry('Topic c: Coherence, #2f6aa1'), { kind: 'topic', alias: 'c', name: 'Coherence', color: '#2f6aa1', style: null });
  assert.deepEqual(readEntry('topic v: Verbs, circle'), { kind: 'topic', alias: 'v', name: 'Verbs', color: null, style: 'circle' });
  assert.deepEqual(readEntry('topic v: Verbs, Highlight, teal'), { kind: 'topic', alias: 'v', name: 'Verbs', color: 'teal', style: 'highlight' });
  assert.equal(readEntry('reviewer ~: Nope'), null);
  assert.equal(readEntry('title: A Talk'), null);
  const key = makeKey([readEntry('reviewer #: Josh'), readEntry('reviewer m: Maria, teal'), readEntry('topic c: Coherence')]);
  assert.equal(key.get('m').color, 'var(--gm-green)');
  // Reviewers are dealt colours from the palette's start, topics from its end.
  assert.equal(key.get('#').color, 'var(--gm-key-1)');
  assert.equal(key.get('c').color, 'var(--gm-key-8)');
});

test("a colour an author names is the family's hue for it, which reads in light and dark", () => {
  const family = {
    red: ['red', 'crimson', 'maroon'],
    amber: ['amber', 'orange', 'gold', 'yellow', 'brown'],
    moss: ['moss', 'green', 'lime', 'olive'],
    green: ['teal', 'cyan', 'turquoise'],
    blue: ['blue', 'navy'],
    violet: ['violet', 'purple', 'indigo'],
    rose: ['rose', 'pink', 'magenta'],
    slate: ['slate', 'grey', 'gray'],
  };
  for (const [hue, names] of Object.entries(family)) for (const name of names) assert.equal(inFamily(name), `var(--gm-${hue})`, name);
  assert.equal(inFamily('Gold'), 'var(--gm-amber)');
  // the family's green is a teal: a plain green is its moss
  assert.equal(inFamily('green'), 'var(--gm-moss)');
  // a #hex, or a name not listed, as it's written, for the page to keep readable
  assert.equal(inFamily('#ffd700'), '#ffd700');
  assert.equal(inFamily('papayawhip'), 'papayawhip');
  assert.equal(inFamily(null), null);
  const key = makeKey([readEntry('reviewer j: Josh, gold'), readEntry('reviewer m: Maria, navy'), readEntry('topic s: Style, #ffd700')]);
  assert.deepEqual([...key.values()].map((e) => e.color), ['var(--gm-amber)', 'var(--gm-blue)', '#ffd700']);
  const { body } = render('-----\nreviewer j: Josh, gold\ntopic c: Coherence, yellow\n-----\n\nWords.\n\n~jc Hm.\n');
  assert.match(body, /<span class="gm-who" style="--by: var\(--gm-amber\)">Josh <b>1<\/b><\/span><span class="gm-topic" style="--topic: var\(--gm-amber\)">Coherence <b>1<\/b><\/span>/);
});

test("a colour an author wrote that isn't the family's is marked for the page to keep readable, and the family's isn't", () => {
  assert.equal(ownColor('#ffd700'), true);
  assert.equal(ownColor('papayawhip'), true);
  assert.equal(ownColor('var(--gm-amber)'), false);
  assert.equal(ownColor('var(--gm-key-1)'), false);
  assert.equal(ownColor(null), false);
  const { body } = render('-----\nreviewer j: Josh, gold\nreviewer m: Maria, #ffd700\ntopic c: Coherence\ntopic s: Style, papayawhip\n-----\n\nWords.\n\n~jc Hm.\n~ms So.\n');
  // the legend: gold is the family's amber, and Coherence a dealt colour, both drawn as they're defined
  assert.match(body, /<div class="gm-legend"><span class="gm-who" style="--by: var\(--gm-amber\)">Josh <b>1<\/b><\/span><span class="gm-who gm-own" style="--by: #ffd700">Maria <b>1<\/b><\/span><span class="gm-topic" style="--topic: var\(--gm-key-8\)">Coherence <b>1<\/b><\/span><span class="gm-topic gm-own" style="--topic: papayawhip">Style <b>1<\/b><\/span><\/div>/);
  // and an aside's chips
  assert.match(body, /<span class="gm-by"><span class="gm-who">Josh<\/span><span class="gm-topic" style="--topic: var\(--gm-key-8\)">Coherence<\/span><\/span>Hm./);
  assert.match(body, /<span class="gm-by"><span class="gm-who gm-own">Maria<\/span><span class="gm-topic gm-own" style="--topic: papayawhip">Style<\/span><\/span>So./);
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
  assert.match(body, /<div class="gm-aside-cell gm-attributed" role="note" style="--by: var\(--gm-key-1\)">\n<p><span class="gm-by"><span class="gm-who">Josh<\/span><span class="gm-topic" style="--topic: var\(--gm-key-8\)">Coherence<\/span><\/span>Contradicts.<\/p>/);
  // A topic alone keeps the usual rule; an undeclared alias is marked.
  assert.match(body, /<div class="gm-aside-cell gm-attributed" role="note">\n<p><span class="gm-by"><span class="gm-topic"[^>]*>Coherence<\/span><span class="gm-unknown"[^>]*>x\?<\/span><\/span>Also.<\/p>/);
  assert.match(body, /<span class="gm-mark" aria-hidden="true">~<\/span>Mine./);
  assert.match(body, /<div class="gm-legend"><span class="gm-who" style="--by: var\(--gm-key-1\)">Josh <b>1<\/b><\/span><span class="gm-topic" style="--topic: var\(--gm-key-8\)">Coherence <b>2<\/b><\/span><\/div>/);
  // The key isn't masthead meta.
  assert.doesNotMatch(body, /reviewer #/);
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
