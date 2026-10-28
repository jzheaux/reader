---
title: Recipes, and other steps to follow
multibox:
  stages: have, prepped, used
---

← [Contents](index.md)

## Amounts that scale

`count:` before an amount marks it as one that scales, and `multiplier:[]`
sets buttons, 1×, 2× and 3×, that multiply every count in its section: the
heading it's under, to the next heading at that level or above. So a file
of recipes has a multiplier for each.

::: tabs
+++ Source
```markdown
## Akara
Serves: count:4
multiplier:[]

* count:2 cups dried black-eyed peas
* count:1–2 fresh chili peppers
* (optional) count:1/2 teaspoon ground cayenne

1) Fry in batches of count:5–6, 3–4 minutes a side.
```
+++ Rendered
## Akara
Serves: count:4
multiplier:[]

* count:2 cups dried black-eyed peas
* count:1–2 fresh chili peppers
* (optional) count:1/2 teaspoon ground cayenne

1) Fry in batches of count:5–6, 3–4 minutes a side.
:::

- Name other multiples in the brackets: `multiplier:[1/2, 2, 4]`. 1× is
  always among them, to go back.
- An amount is a whole number, a fraction (`1/2`, `1 1/2`, `½`), a decimal
  or a range of them (`1–2`, `2 to 3`), and it's multiplied as written:
  `1/2` three times is `1 1/2`. A changed amount is tinted, and shows what
  was written on hover.
- A number without `count:` stays as it is: 5 minutes, 2 inches of oil.
- The multiple picked is yours, not the file's: it's remembered for that
  recipe in that document, as you edit and the next time you open it.

## Boxes with stages

Boxes in a row, `- [ ][ ][ ]`, are **one box with stages**: each click fills
the next, written back as `[x][x][ ]`, and once they're all filled the item
goes gray. A click on a full box empties it, and a shift-click goes back a
stage. `stages:` under `multibox:` in the front matter names the stages
of every staged box in the document, and the stage reached shows beside
the box. This page's front matter names them, for the sample:

::: tabs
+++ Source
```markdown
---
multibox:
  stages: have, prepped, used
---

* [x][x][ ] count:1 small yellow onion, diced
* [x][ ][ ] count:2 cloves garlic, minced
```
+++ Rendered
* [x][x][ ] count:1 small yellow onion, diced
* [x][ ][ ] count:2 cloves garlic, minced
:::

`reset:[]` is a **Start over** button: it clears every box in its section,
plain, staged or a choice, as one edit you can undo. `reset:[Clear]` names
it. It's as much for a todo list or a game as for a recipe.

## Steps to follow

A `1)` list whose items have boxes is **steps to follow**: each number badge
is the step's box, and a click on it marks the step done, a check in its
place. On a slide being presented, the badges only show which are done.

::: tabs
+++ Source
```markdown
1) [x] Heat a splash of oil in a large pot.
2) [ ] Add the diced onion and cook until soft, about 5 minutes.
> [!TIP]
> Go slow; it's sweeter.

3) [ ] Stir in the garlic.
```
+++ Rendered
1) [x] Heat a splash of oil in a large pot.
2) [ ] Add the diced onion and cook until soft, about 5 minutes.
> [!TIP]
> Go slow; it's sweeter.

3) [ ] Stir in the garlic.
:::

- Once a step is done, the first not done is lit up, and marking that one
  done lights the next. Click a step to light it instead; with the page
  clicked into, `j` and `k` light the next and the one before, and `x`
  marks the lit one done, or not done again; each says which step it
  left lit. They're left to a box, button or link Tabbed to, but for a
  step's own. What's lit is only on the page, not in the file.
- The steps under one heading go together, across a callout or a quote
  between them.
- While steps are under way -- begun and not all done -- the screen is kept
  on, as hands are busy. (A browser keeps it on only for a page on
  `localhost` or https: not one opened by the machine's address on the
  network.)

## Ingredients

`!word` in a list item **ties an ingredient to the steps that use it**. The
word is the item's key, as a definition's `!` names its term, and elsewhere
in the recipe it's found without one, plural or singular, so a step that
names it can't slip by:

::: tabs
+++ Source
```markdown
### Ingredients
* [ ] count:1 small yellow !onion, diced
* [ ] a handful of fresh !cilantro, chopped

### Steps
1) [ ] Add the diced onion and cook until soft.
```
+++ Rendered
### Ingredients
* [ ] count:1 small yellow !onion, diced
* [ ] a handful of fresh !cilantro, chopped

### Steps
1) [ ] Add the diced onion and cook until soft.
:::

- The word is underlined where it's used, and hovering or focusing it shows
  its item, amounts multiplied; Enter on it shows it or puts it away, and
  Esc puts it away.
- The lit step's ingredients are lit, in the step and in the list.
- When the last step that names an ingredient is marked done, its box is
  marked too, in the same edit: a box with stages filled, a plain one
  ticked.
- An ingredient that nothing else in the recipe names is flagged *in no
  step*.
- The recipe is the section with the multiplier, if there is one; or else
  the section the list's heading is under (`## Akara`, for a list under
  `### Ingredients`), unless it's one of the document's top headings.
- A `!` before a word a definition defines is the definition's, and `\!`
  keeps one as typed.

## A log

A heading `Log` in a recipe keeps **when it was made and how it went**, in
retro cards (see [Notes on a talk](notes.md)): a heading for each time, and
`Try` for what to change next time, ticked once it's been tried.

::: tabs
+++ Source
```markdown
### Log
#### date:2026-10-18[] · 2×
Good (Ana): loved the plantains
+1 (Sam)
Try (Josh): half the cumin
```
+++ Rendered
### Log
#### date:2026-10-18[] · 2×
Good (Ana): loved the plantains
+1 (Sam)
Try (Josh): half the cumin
:::

With a log in its section, `reset:[]` has a **Log today** button beside
Start over, which adds a heading for today after the log's last entry, with
the multiple the recipe is at.
