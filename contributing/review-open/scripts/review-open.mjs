// Lays out a day's review folder: review.md as the index, a folder gh-N/ for
// each item to look at, holding its review.md, try files and shots/, and
// retro.md with the last retro's untried Tries carried in. Fills in what a script can know; the rest is <fill>.
// Refuses to overwrite anything.
// The index's first line counts what's on the branch, if its worktree is there (counts.mjs);
// --no-checks counts without running npm test and lint.
//   node review-open.mjs <YYYY-MM-DD> --branch review/YYYY.MM.DD --tag 0.0.4 --look 221,237 --done 240,116 [--root <meetings dir>] [--no-checks]
import fs from 'node:fs';
import path from 'node:path';
import { config, reviewers, tilde } from '../../lib/config.mjs';
import { counts, line } from '../../lib/counts.mjs';
import { worktreeFor } from '../../lib/git.mjs';
import { link, standing, title } from '../../lib/issues.mjs';
import { carried, lastRetro as lastRetroOf } from '../../lib/retros.mjs';

const c = config();
const REVIEWERS = reviewers(c);
// What settles a question is said beside it, in the margin, as an aside of the AI's
// with this topic (`~co`), where it can't be read as one of its choices.
const OUTCOME = 'topic o: Outcome';
const args = process.argv.slice(2);
const date = args[0];
const opt = (name, or = '') => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? or : args[i + 1];
};
const list = (name) => opt(name).split(',').filter(Boolean);
const root = path.resolve(opt('root', c.meetings));
const branch = opt('branch', `review/${(date ?? '').replaceAll('-', '.')}`);
const worktree = tilde(worktreeFor(c.main, branch));
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
  console.error('usage: review-open.mjs <YYYY-MM-DD> --branch <b> --tag <t> --look 1,2 --done 3,4 [--root <dir>]');
  process.exit(2);
}

const looks = list('look').map((n) => ({ n, title: title(n) }));
const dones = list('done').map((n) => ({ n, title: title(n) }));
const day = path.join(root, date);
const where = fs.existsSync(worktreeFor(c.main, branch))
  ? line(counts(worktreeFor(c.main, branch), { checks: !args.includes('--no-checks') }))
  : '<fill: counts of issues, commits, tests, lint, what\'s pushed>';

// A net for what got past batch-start: an item still offered to contributors.
for (const { n } of [...looks, ...dones]) {
  if (standing(n).label) console.warn(`warning: gh-${n} is still labelled good first issue; check for an open PR, then remove it`);
}

function write(rel, text) {
  const abs = path.join(day, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, { flag: 'wx' });
  console.log(`wrote ${abs}`);
}

const index = `---
title: Review ${date}
${REVIEWERS}
${OUTCOME}
tags: ${opt('tag')}
multibox:
  stages: heard, agreed, done
---

<fill: one line on what this batch is.>
Branch \`${branch}\` (worktree \`.claude/worktrees/${branch.replace('/', '-')}\`): ${where}.

- [ ] Send to ${c.ai}

Each item below has a file and a box of its own: tick its **Send to ${c.ai}** when you've written in it, and I'll answer only that file while you carry on with the next.
This box is for anything in this page, or for everything at once.

To try it, run the branch's reader. It starts again when reader's code changes, and the page shows the change by itself.

\`\`\`sh
reader-review --at ${branch} ${tilde(day)} --port 8734 --no-browser
\`\`\`

\`reader-review <dir>\` runs the newest review worktree's reader on any folder, as \`reader <dir>\` does; \`node contributing/link.mjs\` puts it on the PATH. Without it, \`npm --prefix ${worktree} run dev -- ${tilde(day)} --port 8734 --no-browser\`.

## Please look
progress:[]

<fill: the order to look at them in, and why, as the items are in that order.>

${looks.map(({ n, title: t }) => `### gh-${n} ${t}

- [ ][ ][ ] [Its file](gh-${n}/review.md), ${link(n)}: <fill: one line of where it stands>.
`).join('\n')}
## Done, nothing to look at
progress:[]

${dones.map(({ n, title: t }) => `- [ ] ${link(n)} ${t}. <fill: one line, how it was checked, and that the issue still describes what shipped.>`).join('\n')}

## Found along the way

<fill: bugs found that aren't from this batch, each a \`- [ ]\` with its proposals: fix now or file. Remove this section if there are none.>

## [ ] Before merging
progress:[]

The merge waits on everything above.

<fill: \`- [ ]\` for each thing only you can do about the whole batch, not one item.>

Waiting on me: <fill>.
Waiting on a contributor: <fill>.
Left in ${opt('tag', 'this milestone')} after this: <fill>.

- [ ] Then: push, open the PR, merge it.
`;

const item = ({ n, title: t }) => `---
title: gh-${n} ${t}
${REVIEWERS}
${OUTCOME}
---

← [review](../review.md)

- [ ] Send to ${c.ai}

# [ ] Review
progress:[]

## Changes

${link(n)} <fill: what someone sees now, what you decided, and anything beyond the issue; what any supporting piece is for, and what it costs; and any \`Contortion:\`.>

## Tries

Try: <fill: [what it shows](try-<what>.md), a try file or a \`try-<what>/\` folder beside this file, or a [shot](shots/<what>.png) from \`npm run shots\`; one \`Try:\` card for each, with a line under it on what to look for.>

## [ ] Acceptance Criteria
progress:[]

All the following criteria must be accepted for this review to be complete.

1) [ ] Chrome: <fill: how it was checked; or "Check Chrome: <what to look for>", if it wasn't; or remove>
2) [ ] Safari: <fill>
3) [ ] Firefox: <fill>
4) [ ] :iphone: phone: <fill>
5) [ ] **<fill: an open point, in words>**

   <fill: what it's about. A thing only to make you aware has no question; a settled decision is ticked, with why and what was turned down.>

   Q (${c.ai}): <fill>?
   - ( ) Yes
   - ( ) [@ Something else]

## Closing

<fill: compare gh-${n} with what shipped, and give your reasoning.>

Q (${c.ai}): Does ${link(n)} still describe what shipped?
- ( ) The issue stands
- ( ) The issue stands, with this closing comment:

  > <fill: the comment as it would be posted, on what went beyond the issue; or "Nothing went beyond it.">
- ( ) A PR replaces it
- ( ) [@ Something else]
`;

const lastRetro = lastRetroOf(root, date);
const tries = lastRetro ? carried(fs.readFileSync(lastRetro, 'utf8')) : [];
const retro = `---
title: Retro ${date}
${REVIEWERS}
---

How [the review](review.md) of date:${date}[] went.
Add your own cards anywhere, \`+1\` the ones you agree with, and answer a card with \`A (${c.contributor}):\` under it.
I'll answer under yours with \`A (${c.ai}):\`, one discussion at a time.

## Good

## Bad

## Try

${tries.join('\n\n')}
`;

// Nothing is written if any of it is there already, so a second run changes nothing.
const targets = ['review.md', ...looks.map((l) => `gh-${l.n}/review.md`), 'retro.md'];
const there = targets.filter((rel) => fs.existsSync(path.join(day, rel)));
if (there.length) {
  console.error(`already there, so nothing written: ${there.map((rel) => path.join(day, rel)).join(', ')}`);
  process.exit(1);
}
write('review.md', index);
for (const l of looks) {
  write(`gh-${l.n}/review.md`, item(l));
  fs.mkdirSync(path.join(day, `gh-${l.n}`, 'shots'), { recursive: true });
}
write('retro.md', retro);
if (lastRetro) console.log(`carried ${tries.length} untried Tries from ${path.relative(root, lastRetro).split(path.sep).join("/")}`);
