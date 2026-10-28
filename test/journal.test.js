import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pages } from '../src/slides.js';

// The daily journal 0.0.4 is to make possible, written ahead of the syntax it
// promises (see its comment). What reader can't read yet shows as written; as
// each feature lands, this should say what it now draws.
const JOURNAL = readFileSync(new URL('./fixtures/journal.md', import.meta.url), 'utf8');

test('the daily journal is a workbook of its twelve pages, in order', () => {
  const out = pages(JOURNAL, { file: 'journal.md' });
  const titles = out.pages.map((p) => p.body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, '').trim());
  assert.deepEqual(titles, [
    'Today’s Celebrations', 'Daily Exercise', 'Meditation', 'Work To-Do', 'Gratitude Practice', 'Body Check-In',
    'Social Connection', 'Personal To-Do', 'Learning &amp; Reading', 'Body Scan &amp; Stretch', 'Singing Warmup', 'How are you feeling?',
  ]);
});
