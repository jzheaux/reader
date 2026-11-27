---
name: batch-start
description: Check a batch of reader issues before any work on them starts. Use when the contributor hands over a batch, an overnight run, or a review/YYYY.MM.DD branch's issues, before the first commit, and again for any issue that joins a batch already under way, such as one filed during a release review or a review round.
---

# Start a batch

`<ai>` stands for your name in the config (see `contributing/README.md`), `Claude` unless set.

## 1. Make the review worktree first

```sh
node scripts/branch.mjs review <review date, YYYY-MM-DD>   # review/YYYY.MM.DD from main, in .claude/worktrees/review-YYYY.MM.DD
```

Before anything else, so that the contributor runs reader from the review worktree from the start, reading `batch.md` and then the review in it, rather than from main first and the worktree once it's made. Tell them the command:

```sh
reader-review <meetings>/<review date> --port 8734 --no-browser
```

`reader-review` runs the newest review worktree's reader, `--at <branch>` another's, from any folder; `node contributing/link.mjs` puts it on the PATH. If they haven't run that, it's `npm --prefix <repo>/.claude/worktrees/review-YYYY.MM.DD run dev -- <meetings>/<review date> --port 8734 --no-browser`.

## 2. Check, don't remember

```sh
node scripts/batch-start.mjs <milestone> 221,237,240 --day <review date, YYYY-MM-DD>
```

For each issue it lists its milestone, a `good first issue` label, and open PRs that mention it. It also reads the newest `<date>/retro.md` in the day folders (or `--retro <file>`) and lists, as `OWED`, each card whose last `Outcome:` says "waiting on me". It exits 1 if anything needs a look.

With `--day`, it also writes each issue's title, link and body into `<day>/batch.md` in the day folders, under a `## [ ] gh-N` box meaning "the wording's right", and lists as `WORD` each box still unticked. An issue already in the file is left as it is, so the contributor's asides stay; one that joins later is added at the end. Without `--day` it says the wording isn't checked, and won't say "ready to start".

- **Owed from the retro:** do it before the batch, or, if it can't be done now, file it as an issue and tell the contributor. Either way, add a later `A (<ai>):` to that card with an `Outcome:` saying what happened (`Outcome: done, <what>` or `Outcome: gh-N filed`), so it stops being listed. Never start the batch with one still owed.

- **An open PR:** read it. If it covers the issue, leave the issue out of the batch and say so; the other contributor's work comes first.
- **`good first issue`, and no PR covers it:** remove the label before starting, so no one picks it up meanwhile. The command is printed; it's outward, so run it on its own.
- **Outside the milestone asked for:** leave it out, and say so, rather than run ahead.
- **Closed already:** leave it out.
- **Wording not ticked:** tell the contributor `batch.md` is ready, and wait. They change an issue on GitHub themselves, or ask in an aside there, in which case edit the issue on GitHub before the work starts and say under their aside what changed, so the issue stays the record. Answer their asides as in `review-round`. For an overnight run, this is done as they hand it over, before they go.

## When an issue joins later

An issue can join a batch already under way: one filed during the release review, or in a review round, or one the contributor adds. Before its first commit, run the same check on it alone, with the batch's milestone:

```sh
node scripts/batch-start.mjs <milestone> 267 --day <review date>
```

The checks are the same, so it's the same script, not a step of its own. An issue I filed that day can't have a PR yet, but its milestone can be wrong, and the retro's owed outcomes still apply. Say in the review's index which issues joined later, and that they were checked.

## 3. Then lay out the work

The git steps are scripted, so they come out the same each time; don't do them by hand.

```sh
node scripts/branch.mjs issue 221                           # issue/gh-221 from it, in .claude/worktrees/issue-gh-221
node scripts/branch.mjs merge 221 --trailer "Co-Authored-By: <you> <email>"
```

- The review branch, made in step 1, is named for its review date, normally tomorrow. Give `--date` to `issue` and `merge` when there's more than one review branch.
- Work on each issue in its own worktree, so issues can go side by side; `issue` links the review worktree's `node_modules` into it, and `merge` takes the link away. Every commit there is signed off, `git commit -s`, and ends `See gh-N`, its own paragraph just before the trailers.
- `merge` refuses a commit without `See gh-N`, and changes not committed. It merges `--no-ff` as `Merge issue/gh-N: <title>`, with `Closes gh-N`, the trailers you give and the sign-off, then removes the issue's worktree; the branch stays. If it stops on a conflict, resolve it in the review worktree and `git commit -s`, which keeps that message.
- Anything new that's seen is built to be seen and pressed by everyone from its first commit: 24 by 24 pixels to press, 3 to 1 for its marks, and drawn in the system's colours. Decided then, it's cheap; `review-open` checks it.
- A follow-up to an issue already merged is a commit on the review branch ending `Polish gh-N`. A small change with no issue has no issue line.
- Nothing is pushed until `review-close`.

When the batch is merged, use `review-open`.
