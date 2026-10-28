---
title: Forms and checklists
---

← [Contents](index.md)

What's filled in on the page is written into the file, saved like typing,
and can be undone as typing can. All of it works in [Work](presenting.md)
too, where the file can't be typed into. On a slide being presented, none
of it does: boxes, choices, fields and dates show as they stand.

## Tasks

`- [ ] take out the trash` shows a checkbox, and `- [x]` a checked one.
Clicking a box rewrites the `[ ]` in the file, as an ordinary (undoable)
edit. `- ( )` and `- (x)` are radio buttons instead: only one in a list can
be chosen, and choosing one clears the others' `(x)`.

::: tabs
+++ Source
```markdown
- [x] take out the trash
- [ ] water the plants

- ( ) tea
- (x) coffee
```
+++ Rendered
- [x] take out the trash
- [ ] water the plants

- ( ) tea
- (x) coffee
:::

A heading takes a checkbox too, `## [ ] Stretch`, to mark what's under it
done; `## \[ ] Stretch` keeps the brackets as typed. Boxes in a row,
`- [ ][ ][ ]`, are one box with stages (see [Recipes](recipes.md)).

## Fields

A line starting `@ ` is a **form field**: a label, a colon, and whatever's
filled in after it, which can be nothing yet. Each colon is a line of
blank, so a longer answer gets more room, running to the end of the line:

::: tabs
+++ Source
```markdown
@ My Name: Josh
@ Date:
@ Notes:::
```
+++ Rendered
@ My Name: Josh
@ Date:
@ Notes:::
:::

The value still goes on the one line in the file, wrapping only on the page,
and a blank grows if it outruns its lines. Click the label, the blank, or
beside them to fill it in, right on the page: `Enter` (or clicking away)
writes it into the file; `Esc` puts it back; `Tab` and `⇧Tab` write it and
move to the next field or the one before. The value is shown just as typed,
with no markdown.

On a slide being presented, or on an exported page, a field can't be filled
in: it reads as its label and what's written there, or as blank. A field of
choices, below, shows the one picked, and on a slide it can't be changed. On
an exported page its buttons can be clicked, but nothing is saved.

A field whose value is nothing but `( )` choices is one to pick from, its
radio buttons in a row after the label. Clicking one writes `(x)` in front
of it, and `( )` in front of the rest.

::: tabs
+++ Source
```markdown
@ Session: ( ) Sat AM (x) Sat PM ( ) Sun AM ( ) Sun PM
```
+++ Rendered
@ Session: ( ) Sat AM (x) Sat PM ( ) Sun AM ( ) Sun PM
:::

## Blanks in a sentence

A blank can also sit inside a sentence, filled in the way a madlib is:
`[@ ` and what goes there, which shows small under the blank. It's filled in
as a field is, and the answer is written after a colon and shown bold, to
stand apart from the sentence.

::: tabs
+++ Source
```markdown
The [@ an animal: walrus] jumped over the [@ a piece of furniture].
```
+++ Rendered
The [@ an animal: walrus] jumped over the [@ a piece of furniture].
:::

Square brackets typed into it are written as round ones, so they don't end
it early. One followed by `(` is a link, as `[text](url)` is, and a
backslash (`\[@ `) keeps it as typed.

## Dates

`date:` is a day, written year-month-day and read in words. Words in the
brackets are shown instead, and with no day at all it is a blank to pick one
into:

| You write | Shows |
| --- | --- |
| `date:2026-11-10[]` | November 10, 2026 |
| `date:2026-11-10[the deadline]` | the deadline |
| `date:[]` | *pick a date* |

::: tabs
+++ Source
```markdown
Drafts by date:2026-11-10[the deadline], reviews by date:2026-11-17[], and
the party on date:[].
```
+++ Rendered
Drafts by date:2026-11-10[the deadline], reviews by date:2026-11-17[], and
the party on date:[].
:::

Hover a date and a calendar shows its month, the day marked. Click the date
(or press `Enter` on it) and the calendar stays open: `‹` and `›` go from
month to month, and clicking a day writes it into the file in the date's
place. The arrow keys move by a day or a week, `PageUp` and `PageDown` by a
month, `Enter` picks, and `Esc` or a click elsewhere closes it. This works
in Work too, though not on a slide. A date that isn't one
(`date:2026-02-30[]`) stays as typed.

## Starting over

`reset:[]` is a **Start over** button: it clears every box in its section
(the heading it's under, to the next at that level or above), plain,
staged or a choice, as one edit you can undo. `reset:[Clear]` names it.
It's as much for a todo list or a game as for a [recipe](recipes.md).
