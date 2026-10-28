---
title: Notes on a talk
---

← [Contents](index.md)

## Questions and answers

`Q:` and `A:` at the start of a line make an exchange, set apart from the
notes around it: the question in italics, the answer upright. A name in
parentheses shows beside the label. Another `A:` straight after an answer --
unnamed, or naming the same person -- continues it as a new paragraph, and the
same goes for `Q:`:

::: tabs
+++ Source
```markdown
Q (audience): Is this a pendulum swing or an integration?
A (Thomas): An integration.

A: The renaissance and the scientific revolution each had half of it.
A (Sarah): I'd say it's a spiral.
```
+++ Rendered
Q (audience): Is this a pendulum swing or an integration?
A (Thomas): An integration.

A: The renaissance and the scientific revolution each had half of it.
A (Sarah): I'd say it's a spiral.
:::

That is one answer from Thomas in two paragraphs, then one from Sarah. Any
line starting at the margin that isn't `Q:` or `A:` ends the exchange.

A backslash (`\A:`) keeps a line that happens to start that way as typed.

## Retro cards and votes

A retro's cards work the same way: `Good:`, `Bad:` and `Try:` each start a
card, labelled G, B or T in blue-green, red-orange or blue, colours that
stay apart for most colour blindness too, with `A:` after it as its
discussion. Every card
line is a card of its own, even from the same person twice in a row. `+1`
under a card or a question is a vote for it, named or not, with a comment
after a colon or not; the card shows how many votes it has:

::: tabs
+++ Source
```markdown
Bad (Josh): We were surprised by the release deadline
+1 (Rob)
+1 (Joe): same, I found out the day of
A (Rob): Would like to see those planned relative to the calendar.

Try [x] (Ana): Put the release dates on the team calendar
```
+++ Rendered
Bad (Josh): We were surprised by the release deadline
+1 (Rob)
+1 (Joe): same, I found out the day of
A (Rob): Would like to see those planned relative to the calendar.

Try [x] (Ana): Put the release dates on the team calendar
:::

A `+1` with no card or question above it stays as typed.

Clicking a card's G or B marks its discussion done: the line gets an
`[x]` (`Good [x] (Josh):`), and the card, its votes and its answers fade.
Click again to take it away. A `Try`'s T is a box instead, ticked once it's
been tried: the same `[x]`, a check in place of the T, and the card stays
as it was. On a slide being presented, a card shows whether it's done but
can't be clicked.

## Definitions

A line starting `!` is a **definition**: a term, a colon, and what it
means, set as a dictionary sets it: in a box, the term in bold small capitals
on a tint. The meaning is markdown like any other line (links, bold, `[red]{red}`), and who
used the term can follow it in parentheses, as in an exchange:

::: tabs
+++ Source
```markdown
!SLAB (Venkat): similar layers of abstraction
!gatherer: an intermediate operation that can see the whole stream
!gatherer: one that keeps its own *state* between elements
!REPL:

Venkat keeps coming back to !SLAB.
```
+++ Rendered
!SLAB (Venkat): similar layers of abstraction
!gatherer: an intermediate operation that can see the whole stream
!gatherer: one that keeps its own *state* between elements
!REPL:

Venkat keeps coming back to !SLAB.
:::

Definitions on lines in a row make one glossary, and the same term again
straight after is another sense of it, numbered. A term with nothing after
its colon is one you heard but haven't looked up: it reads *not yet
defined*, and clicking it fills it in as a field is. A term in capitals
whose meaning spells it out has those letters bolded: **s**imilar
**l**ayers of **ab**straction.

Written with a `!` before it anywhere else in the document -- before its
definition or after, in an aside, on a later slide of a deck -- the term is
set as it is in its entry, and its meaning shows on hover.

A term in capitals is matched as written, or with an `s` (`!SLOs`); one in
lower case, in any case and plural or singular (`!Sealed interfaces` at the
start of a sentence). A `!` before a word that
isn't defined is left as typed, as are code and links.

A backslash (`\!SLAB:`, `\!SLAB`) keeps a line or a word that happens to
start that way as typed.

## Quotes

A blockquote whose last line starts with `--` takes that line as its
attribution, set right-aligned under the quote. Links, and `scripture:`, work
there as anywhere:

::: tabs
+++ Source
```markdown
> The road of excess leads to the palace of wisdom.
> -- [William Blake](https://en.wikipedia.org/wiki/The_Marriage_of_Heaven_and_Hell)
```
+++ Rendered
> The road of excess leads to the palace of wisdom.
> -- [William Blake](https://en.wikipedia.org/wiki/The_Marriage_of_Heaven_and_Hell)
:::
