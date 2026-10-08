import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duration, clockTime, readNotes, plan, planEnd } from '../src/pacing.js';
import { slides } from '../src/slides.js';

test('durations and clock times', () => {
  assert.equal(duration('1.5m'), 90);
  assert.equal(duration('90s'), 90);
  assert.equal(duration('1.5 min'), 90);
  assert.equal(duration('50'), 3000);
  assert.equal(duration('1h'), 3600);
  assert.equal(duration('2 minutes'), 120);
  assert.equal(duration('soon'), null);
  assert.equal(clockTime('0:12'), 720);
  assert.equal(clockTime('1:05'), 3900);
  assert.equal(clockTime('12m'), 720);
});

test('a note says where its slide should start, and how long it takes', () => {
  assert.deepEqual(readNotes('ACT 2 (16 min). Clock should read about 0:12.\nParaphrase.'),
    { notes: 'ACT 2 (16 min). Clock should read about 0:12.\nParaphrase.', at: 720, budget: null });
  assert.deepEqual(readNotes('ACT 0 · COLD OPEN (4 min). Clock: 0:00.'),
    { notes: 'ACT 0 · COLD OPEN (4 min). Clock: 0:00.', at: 0, budget: null });
  assert.deepEqual(readNotes('time: 1.5m\nThe Spolsky gloss is yours.\n\nat: 0:20'),
    { notes: 'The Spolsky gloss is yours.', at: 1200, budget: 90 });
  // Durations in the prose are the speaker's, and lines that only look
  // like settings stay.
  assert.deepEqual(readNotes('1.5 min. Say so.\ntime: be quick'), { notes: '1.5 min. Say so.\ntime: be quick', at: null, budget: null });
});

test('budgets and checkpoints plan each slide\'s start', () => {
  const s = (at, budget) => ({ at, budget });
  // Checkpoints at 0 and 10m, three slides between: the 10 minutes are
  // shared, after the one budget.
  assert.deepEqual(plan([s(null, null), s(null, 120), s(null, null), s(600, null)]), [0, 240, 360, 600]);
  // Past the last checkpoint, budgets carry on until one is missing.
  assert.deepEqual(plan([s(null, 60), s(null, 30), s(null, null), s(null, 60)]), [0, 60, 90, null]);
  // The talk's length closes the last stretch.
  assert.deepEqual(plan([s(null, null), s(300, null), s(null, null)], 900), [0, 300, 600]);
  // A checkpoint holds even when the budgets before it don't add up to it.
  assert.deepEqual(plan([s(null, 600), s(300, null)]), [0, 300]);
  assert.deepEqual(plan([]), []);
});

test('a deck\'s slides carry their plan, and their notes lose the settings', () => {
  const out = slides([
    '---', 'time: 20m', '---', '',
    '# Open', '<!-- Clock: 0:00. -->', '---',
    '## Two', '<!--\ntime: 2m\nSay **this**.\n-->', '---',
    '## Three', '---',
    '## Act 2', '<!-- Clock should read about 0:10. -->', '---',
    '## Last', '',
  ].join('\n'));
  assert.deepEqual(out.slides.map((x) => x.plan), [0, 240, 360, 600, 900]);
  assert.equal(out.end, 1200);
  assert.equal(out.slides[1].notes, 'Say **this**.');
  assert.equal(out.slides[1].notesHtml, '<p>Say <strong>this</strong>.</p>');
  assert.equal(planEnd([{ budget: 60 }], [0]), 60);
});
