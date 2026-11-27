import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { render } from '../../src/render.js';
import { boxes, open } from '../lib/asides-open.mjs';
import { read, run, scratch, settings, tree } from './setup.mjs';

const GH = {
  issues: {
    21: { title: 'Pages fold', milestone: '0.0.5' },
    22: { title: 'Tabs move on', milestone: '0.0.5', labels: ['good first issue'] },
    23: { title: 'Typo in the docs', milestone: '0.0.5' },
  },
};

// A day folder laid out for 2026-11-22, after a retro on 2026-11-09 with one Try left untried.
function laidOut(t, over = {}) {
  const dir = scratch(t);
  const env = settings(dir, { gh: GH, READER_CONTRIBUTOR: 'Grace', READER_AI: 'Codex', ...over });
  tree(env.READER_MEETINGS, {
    '2026-11-09/retro.md': '## Try\n\nTry (Grace): shorter rounds.\nA (Codex): Agreed.\n\nTry [x] (Codex): tried already.\n\nThat closes it.\n',
    // A retro after the review's date isn't the last one before it.
    '2026-11-30/retro.md': 'Try (Grace): from later.\n',
  });
  const r = run('review-open/scripts/review-open.mjs', ['2026-11-22', '--tag', '0.0.5', '--look', '22,21', '--done', '23'], env);
  return { ...r, env, day: path.join(env.READER_MEETINGS, '2026-11-22') };
}

test('it lays out the index, a folder for each item to look at, and the retro with the untried Tries carried in', (t) => {
  const { status, out, day } = laidOut(t);
  assert.equal(status, 0, out);
  for (const rel of ['review.md', 'gh-22/review.md', 'gh-21/review.md', 'retro.md']) assert.ok(fs.existsSync(path.join(day, rel)), rel);
  assert.ok(fs.statSync(path.join(day, 'gh-22', 'shots')).isDirectory());
  assert.ok(!fs.existsSync(path.join(day, 'gh-23')), 'a Done item has no folder');
  assert.match(out, /^carried 1 untried Tries from 2026-11-09\/retro\.md$/m);
  assert.match(out, /^warning: gh-22 is still labelled good first issue/m);

  const retro = read(day, 'retro.md');
  assert.match(retro, /^Try \(Grace\): shorter rounds\.\nA \(Codex\): Agreed\.\n?$/m);
  assert.doesNotMatch(retro, /tried already|That closes it|from later/);
  assert.match(retro, /answer a card with `A \(Grace\):` under it\.\nI'll answer under yours with `A \(Codex\):`/);
});

test('the index uses the config\'s names and repo, lists the items in the order given, and renders as boxes and headings', (t) => {
  const { day } = laidOut(t);
  const index = read(day, 'review.md');
  assert.match(index, /^reviewer #: Grace\nreviewer c: Codex\ntopic o: Outcome\ntags: 0\.0\.5$/m);
  assert.match(index, /^Branch `review\/2026\.11\.22` \(worktree `\.claude\/worktrees\/review-2026\.11\.22`\)/m);
  assert.ok(index.indexOf('### gh-22 Tabs move on') < index.indexOf('### gh-21 Pages fold'));
  assert.match(index, /^- \[ \] gh:acme\/reader#23\[gh-23\] Typo in the docs\./m);
  assert.match(index, /^reader-review --at review\/2026\.11\.22 .*2026-11-22 --port 8734 --no-browser$/m);
  assert.match(index, /run dev -- .*2026-11-22 --port 8734 --no-browser/);

  const { body, title } = render(index);
  assert.equal(title, 'Review 2026-11-22');
  assert.match(body, /aria-label="Send to Codex"/);
  assert.equal(body.match(/class="task staged"/g)?.length, 2, 'a staged box for each item to look at');
  assert.match(body, /<span class="section-title"[^>]*>Before merging<\/span><button type="button" class="section-done"/);
  assert.match(body, /href="https:\/\/github\.com\/acme\/reader\/issues\/23"/);
});

test('each item reads in the order it is looked at, and renders its cards, criteria and choices', (t) => {
  const { day } = laidOut(t);
  const item = read(day, 'gh-21', 'review.md');
  const heads = item.match(/^#+ .*$/gm);
  assert.deepEqual(heads, ['# [ ] Review', '## Changes', '## Tries', '## [ ] Acceptance Criteria', '## Closing']);
  assert.match(item, /^Q \(Codex\): Does gh:acme\/reader#21\[gh-21\] still describe what shipped\?$/m);

  const { body, title } = render(item);
  assert.equal(title, 'gh-21 Pages fold');
  assert.match(body, /class="qa qa-card qa-try"/);
  assert.match(body, /class="task step"/);
  assert.match(body, /class="choice-box"/);
  assert.match(body, /class="qa qa-q"/);
});

test('what it lays out waits on the contributor, not the AI, until it is filled in', (t) => {
  const { day } = laidOut(t);
  assert.deepEqual(open(day, day, { ai: 'Codex' }), []);
  const waiting = boxes(day, day, { ai: 'Codex' }).map((b) => b.at);
  assert.ok(waiting.includes('gh-21/review.md:21'), 'its Try');
  assert.ok(waiting.some((at) => at.startsWith('gh-22/')), 'the other item');
  assert.ok(waiting.some((at) => at.startsWith('review.md:')), 'the index');
});

test('it writes nothing if any of the day is there already', (t) => {
  const { env, day } = laidOut(t);
  fs.rmSync(path.join(day, 'gh-21'), { recursive: true });
  fs.writeFileSync(path.join(day, 'review.md'), 'mine\n');
  const again = run('review-open/scripts/review-open.mjs', ['2026-11-22', '--look', '21'], env);
  assert.equal(again.status, 1);
  assert.match(again.out, /^already there, so nothing written: .*review\.md, .*retro\.md$/m);
  assert.equal(read(day, 'review.md'), 'mine\n');
  assert.ok(!fs.existsSync(path.join(day, 'gh-21')));
});

test('without a date it says how to run it', (t) => {
  const dir = scratch(t);
  const { status, out } = run('review-open/scripts/review-open.mjs', ['--look', '21'], settings(dir));
  assert.equal(status, 2);
  assert.match(out, /^usage: review-open\.mjs/);
});
