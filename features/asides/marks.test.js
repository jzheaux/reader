import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';

const KEY = '-----\ntopic a: adjectives, circle\ntopic v: verbs, teal, highlight\ntopic c: clauses\n-----\n\n';

/** The marks in a page: `[{ id, style, color, text }]`. */
const marks = (body) => [...body.matchAll(/<span class="mk mk-(\w+)" role="mark"(?: title="[^"]*")?(?: style="--mk: ([^"]+)")? data-mark="([^"]+)">([^<]*)/g)]
  .map(([, style, color, id, text]) => ({ id, style, color, text }));
/** Each aside about words: the mark it's tied to and the words it set at its start. */
const tied = (body) => [...body.matchAll(/<div class="gm-aside-cell[^"]*" role="note"(?: style="[^"]*")?(?: data-mark="([^"]+)")?(?: data-in-tab="\d+")?>\n<p>(?:<span class="gm-by">.*?<\/span><\/span>|<span class="gm-mark" aria-hidden="true">~<\/span>)?<q class="mk-about[^"]*"[^>]*>([^<]*)<\/q>/g)]
  .map(([, id, words]) => ({ id, words }));

test('an aside marks the words it names in the line above, in its topic\'s colour and style', () => {
  const { body } = render(`${KEY}the quick brown fox\n~a[quick] nice job\n`);
  assert.deepEqual(marks(body), [{ id: 'mk-1', style: 'circle', color: 'var(--gm-key-8)', text: 'quick' }]);
  assert.deepEqual(tied(body), [{ id: 'mk-1', words: 'quick' }]);
  assert.match(body, /<div class="gm-aside-cell gm-attributed" role="note" style="--mk: var\(--gm-key-8\)" data-mark="mk-1">/);
  assert.match(body, /<\/q>nice job<\/p>/);
});

test('a mark is one to a screen reader, its topic said with it and shown on hover, not only by colour and pen', () => {
  const { body } = render(`${KEY}the quick brown fox\n~a[quick] nice job\n`);
  assert.match(body, /<span class="mk mk-circle" role="mark" title="adjectives" style="--mk: var\(--gm-key-8\)" data-mark="mk-1">quick<\/span>/);
  assert.match(render('[x]{circle}\n').body, /<span class="mk mk-circle" role="mark" data-mark="mk-1">/, 'no topic, no title');
});

test('a topic with no style underlines, and braces after the words override it', () => {
  const { body } = render(`${KEY}the quick brown fox\n~c[brown] plain\n~a[fox]{highlight} picked\n`);
  assert.deepEqual(marks(body).map((m) => m.style), ['underline', 'highlight']);
});

test('words can be underlined dotted or wavy, by a topic, an aside or in braces', () => {
  const key = '-----\ntopic d: doubts, wavy\n-----\n\n';
  const { body } = render(`${key}the quick brown fox\n~d[quick] really?\n~[fox]{dotted} which one\n`);
  assert.deepEqual(marks(body).map((m) => m.style), ['wavy', 'dotted']);
  assert.match(render('[x]{wavy red}\n').body, /<span class="mk mk-wavy" role="mark" style="--mk: var\(--gm-red\)" data-mark="mk-1">x<\/span>/);
  assert.match(render('[x]{dotted}\n').body, /<span class="mk mk-dotted" role="mark" data-mark="mk-1">x<\/span>/);
});

test('a phrase, and #2 for the second time it\'s there', () => {
  const { body } = render(`${KEY}the dog saw the lazy dog\n~c[the lazy dog] a phrase\n~a[dog#2] the second\n`);
  assert.deepEqual(marks(body).map((m) => m.text), ['the lazy ', 'dog']);
  assert.match(body, /saw <span class="mk mk-underline"[^>]*>the lazy <span class="mk mk-circle"[^>]*>dog<\/span><\/span>/);
});

test('words in the line it\'s under come first, then the rest of the paragraph', () => {
  const { body } = render(`${KEY}one fox here\nanother fox there\n~a[fox] the second line's\n~a[here] only in the first\n`);
  assert.match(body, /another <span class="mk mk-circle"[^>]*>fox<\/span> there/);
  assert.match(body, /one fox <span class="mk mk-circle"[^>]*>here<\/span>/);
});

test('after a blank, the paragraph before', () => {
  const { body } = render(`${KEY}one fox here\nanother fox there\n\n~a[fox#2] the second in it\n`);
  assert.match(body, /another <span class="mk mk-circle"[^>]*>fox<\/span>/);
});

test('only whole words, and curly quotes match straight ones', () => {
  const { body } = render(`${KEY}there, then the end; don't stop\n~a[the] a word\n~v["don't"] quoted\n`);
  assert.match(body, /then <span class="mk mk-circle"[^>]*>the<\/span> end/);
  assert.doesNotMatch(render(`${KEY}there\n~a[the] no\n`).body, /class="mk /);
  assert.match(render(`${KEY}I don't know\n~a[don't] curly\n`).body, /<span class="mk mk-circle"[^>]*>don’t<\/span>/);
});

test('words not found are set in the aside with a ?, tied to nothing', () => {
  const { body } = render(`${KEY}the quick brown fox\n~a[slow] nope\n`);
  assert.deepEqual(marks(body), []);
  assert.deepEqual(tied(body), [{ id: undefined, words: 'slow?' }]);
  assert.match(body, /class="mk-about mk-lost" title="Not found in the line above"/);
});

test('a mark written in braces is the one an aside naming its words ties to, as many as name it', () => {
  const { body } = render(`${KEY}jumped over [the lazy dog]{c}\n~c[the lazy dog] one\n~a[the lazy dog] two\n`);
  assert.deepEqual(marks(body), [{ id: 'mk-1', style: 'underline', color: 'var(--gm-key-6)', text: 'the lazy dog' }]);
  // Each aside's line takes its own topic's colour.
  assert.deepEqual(tied(body), [{ id: 'mk-1', words: 'the lazy dog' }, { id: 'mk-1', words: 'the lazy dog' }]);
  assert.match(body, /style="--mk: var\(--gm-key-8\)" data-mark="mk-1"/);
});

test('in braces: a topic, a style, or both; a color is the mark\'s; a lone letter not declared is a font', () => {
  const page = (src) => render(`${KEY}${src}\n`).body;
  assert.match(page('[x]{v}'), /<span class="mk mk-highlight" role="mark" title="verbs" style="--mk: var\(--gm-green\)" data-mark="mk-1">x<\/span>/);
  assert.match(page('[x]{v circle}'), /<span class="mk mk-circle" role="mark" title="verbs" style="--mk: var\(--gm-green\)"/);
  assert.match(page('[x]{circle red}'), /<span class="mk mk-circle" role="mark" style="--mk: var\(--gm-red\)" data-mark="mk-1">x<\/span>/);
  assert.match(page('[x]{underline georgia}'), /<span class="font mk mk-underline" role="mark" style="--font: 'georgia'" data-mark="mk-1">/);
  assert.match(render('[x]{a}\n').body, /<span class="font" style="--font: 'a'">x<\/span>/);
  assert.match(render('[x]{red}\n').body, /<span style="color: red">x<\/span>/);
});

test("the words an aside chose are marked for the page to keep readable only in a colour an author wrote that isn't the family's", () => {
  const page = (topic) => render(`-----\ntopic t: tone, ${topic}\n-----\n\nthe quick fox\n~t[quick] hm\n`).body;
  assert.match(page('gold'), /<q class="mk-about">quick<\/q>/);
  assert.match(page('#ffd700'), /<q class="mk-about gm-own">quick<\/q>/);
});

test('an aside about words keeps its place in a ::: block', () => {
  const { body } = render(`${KEY}::: slategray\nthe quick fox\n~a[the quick fox] all of it\n:::\n`);
  assert.match(body, /<span class="mk mk-circle"[^>]*>the quick fox<\/span>/);
  assert.match(body, /<\/q>all of it<\/p>/);
});

test('the writer\'s own aside can name words too, and one with nothing to say just marks them', () => {
  const { body } = render(`${KEY}the quick brown fox\n~[quick] mine\n~a[fox]\n`);
  assert.deepEqual(marks(body).map((m) => [m.text, m.color]), [['quick', undefined], ['fox', 'var(--gm-key-8)']]);
  assert.match(body, /<div class="gm-aside-cell" role="note" data-mark="mk-1">\n<p><span class="gm-mark" aria-hidden="true">~<\/span><q class="mk-about">quick<\/q>mine<\/p>/);
});

test('a link\'s brackets after a ~ are not words to mark', () => {
  const { body } = render(`${KEY}text\n\n~[a link](https://x.test) is prose\n`);
  assert.doesNotMatch(body, /mk-about/);
});

test('marks are counted through a deck, so no two slides share one', () => {
  const deck = slides(`${KEY}# one\n\nthe fox\n~a[fox] here\n\n---\n\n# two\n\nthe fox\n~a[fox] again\n`);
  const ids = deck.slides.flatMap((s) => marks(s.body).map((m) => m.id));
  assert.equal(new Set(ids).size, 2);
});

test('an aside written in a tab marks its words there, and shows with that tab', () => {
  const { body } = render(`${KEY}::: tabs\n+++ Source\n~~~markdown\nthe quick brown fox\n~a[quick] nice\n~~~\n+++ Rendered\nthe quick brown fox\n~a[quick] nice\n:::\n`);
  assert.deepEqual(marks(body).map((m) => m.text), ['quick']);
  assert.deepEqual(tied(body), [{ id: 'mk-1', words: 'quick' }]);
  assert.match(body, /<div class="gm-aside-cell gm-attributed" role="note" style="[^"]*" data-mark="mk-1" data-in-tab="2">/);
});

test('an aside after a tabs block, or in none, is beside it whichever tab shows', () => {
  const { body } = render(`${KEY}::: tabs\n+++ One\nthe quick brown fox\n:::\n~ all of it\n\nthe lazy dog\n~a[lazy] no tab\n`);
  assert.doesNotMatch(body, /data-in-tab/);
});
