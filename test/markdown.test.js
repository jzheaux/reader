import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frontMatter, fenced } from '../static/markdown.js';
import { readEntry } from '../features/asides/key.js';
import { extract } from '../src/page.js';
import { split } from '../src/slides.js';
import { outline } from '../static/app/sections.js';

const lines = (s) => s.split('\n');

test('front matter is each key in lower case to its value, quotes taken off', () => {
  const m = frontMatter(lines('-----\nTitle: "A Talk"\ntitle font: \'Lora\'\nlink: https://x.test/a\n-----\nbody'));
  assert.deepEqual(m.meta, { title: 'A Talk', 'title font': 'Lora', link: 'https://x.test/a' });
  assert.equal(m.end, 5);
});

test('a key with no value holds the indented keys under it, a level deep', () => {
  const m = frontMatter(lines('---\ntitle: Akara\nMultibox:\n  Stages: "have, in place, used"\n\n  other: x\nauthor: Ana\n  indented: alone\nempty:\n---'));
  assert.deepEqual(m.meta, {
    title: 'Akara',
    multibox: { stages: 'have, in place, used', other: 'x' },
    author: 'Ana',
    indented: 'alone',
    empty: '',
  });
});

test('a line an entry reader takes is an entry, not meta', () => {
  const m = frontMatter(lines('---\nauthor: Josh\nreviewer #: Josh, teal\n---'), { entry: readEntry });
  assert.deepEqual(m.meta, { author: 'Josh' });
  assert.equal(m.entries[0].alias, '#');
});

test('a leading rule is front matter only when what follows it reads as keys and values, and closes', () => {
  assert.equal(frontMatter(lines('---\nA paragraph, not a key.\n---')), null);
  assert.equal(frontMatter(lines('---\ntitle: never closed')), null);
  assert.equal(frontMatter(lines('title: no dashes')), null);
});

test('a document, a deck and the outline read the same front matter', () => {
  const src = '---\nTitle: "A Talk"\ntitle font: Lora\nreviewer #: Josh\n---\n\n# One\n';
  const expected = { title: 'A Talk', 'title font': 'Lora' };
  assert.deepEqual(extract(src).meta, expected);
  assert.deepEqual(split(src).meta, expected);
  assert.equal(outline(src).matter.meta.title, 'A Talk');
});

test('fenced code is its opening line, what it holds and its closing line, in a blockquote or a list too', () => {
  const read = (src) => { const code = fenced(); return lines(src).map((l) => code(l)); };
  assert.deepEqual(read('a\n```\n---\n```\nb'), [false, true, true, true, false]);
  // A shorter or different run doesn't close it, nor does one with text after it.
  assert.deepEqual(read('````\n```\n~~~\n```` x\n````\nb'), [true, true, true, true, true, false]);
  assert.deepEqual(read('> ```\n> code\nafter'), [true, true, false]);
  assert.deepEqual(read('- ```\n  code\nout'), [true, true, false]);
});
