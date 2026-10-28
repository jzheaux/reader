---
title: Work and present
---

← [Contents](index.md)

## Work

**Work** (`⌘.`) hides the file list and the editor and gives the rendered page
the whole window, to read and to fill in. Nothing can be typed into the file, but task checkboxes
and radio buttons still toggle, fields can be filled in, and puzzles can be played. `⌘.` or `Esc` goes back to editing. The mode is remembered.

A deck (below) is a workbook in Work: each slide is a page, shown one at a
time as a document is, at the size it's written and as long as it needs to
be, with nothing of its notes. It opens on the page the cursor was on.

- Under the page are **Back** and **Next**, and a dot for each page: click
  one to go to that page. `⌥←` and `⌥→` turn the page too, as does a swipe.
- A page is done, and its dot filled, when its opening heading's checkbox is
  checked (`# [x] Warm-up`). A page whose heading has no checkbox is done
  when every task on it is ticked and every radio list has a choice. A page
  with nothing to tick doesn't count either way.

## Decks

A file in the format of [slides](https://github.com/maaslalani/slides) also
gets **Present** (`⌘⇧.`). One file then works for both: `slides` in the
terminal and here in the browser.

```markdown
---
author: Josh Cummings
date: October 2026
paging: Slide %d / %d
---

# First slide

<!-- Speaker notes. slides drops them from the terminal; here they're notes. -->

---

# Second slide
```

- A line that is exactly `---` starts a new slide, except inside a code
  fence. Front matter is read only when every line in it is `key: value`.
- HTML comments are a slide's **speaker notes**, written in markdown and
  shown that way. Don't put a `---` line in one: `slides` would split the
  slide there.
- Present opens on the slide under the cursor. If the file changes on disk
  while you present (say you fix a typo in vim), the deck reloads in place.
- A slide being presented is only shown: its boxes, choices, fields, dates
  and cards show as they stand and can't be changed. Work is where a deck
  is filled in. To show a box being ticked, repeat the slide with it ticked.

## Steps

A slide comes in **one step at a time**. Each paragraph, quote, code block,
table or image is a step, and so is each list item, nested ones included,
and each column of a `::: columns` block, in reading order. A slide's opening heading isn't a step: it shows with the
slide. An aside shows with the passage it sits beside. Steps not yet shown
keep their space, so the slide doesn't shift as they appear.

A screen reader hears where the deck is as it moves, and what just showed:
"Slide 1 of 2, step 2 of 3: the second point". A slide come to says its
title, an image its alt text, a field its label and what's in it
("Thoughts: blank"), and code its picked lines. A slide come to whole
(`N`, `End`) says its title and then what shows. A long step is cut to a
sentence or two. Going back a step says only where the deck is, and back
onto a slide only its title.

Code steps through its picked lines and its callouts; see [Code](code.md).

## How a slide sits

A slide's opening heading is its **title**, and stays at the top, on the
left. The rest sits in the **middle** of the space under it, top to bottom
and side to side: a short list sits in the middle as a block, its bullets
still in line with each other, and a paragraph keeps its own alignment. A
slide with a form, a puzzle, columns or asides keeps the slide's full width.
A slide that is all headings, a title slide or a one-line statement, is
centered whole, both ways, and so is one with no opening heading. A quote,
an image, a headline, a number or a `math:[…]` line that is the only thing
on a slide besides its title is centered across the slide too, and an image
there is kept to about two thirds of the slide's height.

A slide is **sized to fit** the window: everything on it together, puzzles
included, as large as it fits, measured with every step showing so it keeps
its size as they appear. A slide with room to spare **grows**, up to twice
its size, so a statement or a short list fills the screen without one short
line turning into a poster; its title and its code stay the size they were,
so titles and code look the same from slide to slide. A slide too full
**shrinks**, title and code with it, no further than 60%. Code still too
wide then wraps, and a slide still too tall scrolls, bringing each step
into view as it appears. The speaker view says how much the current slide
shrank.

How big a slide grows or shrinks is decided with the text at 100%; `⌘+`
and `⌘−` then make that bigger or smaller, as far as it still fits. So `⌘−`
always makes a slide smaller, and `⌘+` makes it bigger when there's room,
and never smaller.

Hover **Present** to see which slides shrink below 80%, or don't fit at
all, at the speaker view's size (1280×720); click one to go to it. Not
every file with a `---` is a deck, so nothing is measured until you hover
Present or present the file; after that, it's measured again as you edit.

## While presenting

| | |
| --- | --- |
| `n` `→` `↓` `Space` `Enter` `PageDown`, or click | next step; after the last one, the next slide |
| `p` `←` `↑` `⌫` `PageUp`, or click the left third | back one step; before the first, the previous slide whole |
| `N` | the rest of this slide; if it's all showing, the next slide whole |
| `P` | back to the start of this slide; if it's already there, the start of the previous slide |
| `Home` / `End` | the first slide / the last slide whole |
| `O` | the overview: every slide at once, to pick one from (below) |
| `T` | notes under the slide |
| `S` | speaker view: the current slide (steps to come drawn faintly), the next slide, notes, a timer, the time |
| `R` | in the speaker view, restart the timer (or click the timer) |
| `F` | full screen |
| `⌘+` / `⌘−` / `⌘0` | the slides' text a step bigger, a step smaller, or back to 100% (Ctrl on Windows and Linux); it starts at 100% each time you present, and the speaker view's slides follow |
| `Tab` / `⇧Tab` | what can be played or opened on the slide, such as a puzzle or a block's tabs, one by one, then back to the slides; the keys that work the one Tabbed to are its own, and the rest still move the slides |
| `?` | these keys, at the foot of the slides; they show for a moment as you start, and when you hover there |
| `Esc` | stop presenting |

`n` and `p` undo each other exactly, so a clicker's back button takes back
what its forward button did.

## Overview

`O` lays out every slide as a thumbnail, numbered as `paging:` says, with
its title when you hover it. The slide showing is ringed and has the
highlight. Move the highlight with the arrows (`↑` `↓` a row, `←` `→` a
slide) and `Home` and `End`; `Enter`, or a click, goes to that slide from
its start, and `Esc` goes back to where you were. It's handy for a backup
slide at question time, or for rehearsing.

A thumbnail is the slide as the stage draws it, every step showing, at the
text size and fit the slides have; `⌘+`, `⌘−` and `⌘0` still size the
text while the overview is out, and the thumbnails follow. A screen
reader hears "Overview" as it opens, and each slide's number and title as
the highlight moves to it.

`O` in the speaker view opens it there instead, out of the room's sight.
There the slides already done are faded and ticked, apart from those still
to come.

## Two screens

The speaker view is its own window, and either window can change slides.
With a second screen plugged in, Present puts the slides full screen on it
and opens the speaker view on the screen reader is on. Chrome and Edge
ask once for leave to see your screens. Elsewhere, or with leave refused,
drag the speaker view to your screen and the slides to the projector, and
press `F` there.

## Pacing

The speaker view's timer starts when you present from the first
slide (click it, or press `R` there, to restart). Tell reader the plan and it
says, under the timer, whether you're ahead of it, on it or behind:

```markdown
---
time: 50m
---

<!--
ACT 2 (16 min). Clock should read about 0:12.
-->

<!--
time: 1.5m
Skip the second demo if running long.
-->
```

- `time:` in the front matter is the talk's length.
- A checkpoint, where a slide should start, is an `at: 0:12` line in its
  notes (hours:minutes), or "Clock: 0:12" or "Clock should read about
  0:12" anywhere in them.
- `time: 1.5m` in a slide's notes is that slide's own budget (`90s`, `2m`,
  `1h`, or a number of minutes).
- Between checkpoints, the time no budget accounts for is shared evenly
  among the slides without one. Other times in the notes' prose aren't
  read: "1.5 min." is the speaker's to keep to.
- `at:` and `time:` lines aren't shown with the notes; a clock line is.

## Transitions

`transition:` says how one slide gives way to the next. In
the front matter it's the deck's; in a slide's notes it's how that slide
leaves, so it goes just above the `---` it's about:

```markdown
---
transition: fade
---

# Most slides fade

---

# This one is pushed up and off

<!-- transition: up -->

---

# By this one
```

- `up`, `down`, `left` and `right` are the way the slides move: the one
  leaving goes off that way, and the next comes on after it. `fade` fades
  one into the other. `none`, a cut, is what a deck that doesn't say gets.
- Going back a slide plays it the other way round. Jumping to a slide
  (`Home`, `End`, the speaker view) is a cut.
- Steps within a slide and the speaker view don't move, and neither does
  anything for someone whose system asks for reduced motion.
- A `transition:` line isn't shown with the notes, unless it doesn't read
  as a transition.

Fonts and backgrounds, for a deck as for any document, are on
[The page](page.md).
