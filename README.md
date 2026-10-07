# reader

A local, two-pane reader and editor for a directory of markdown. Pick a file:
it's rendered on the left and editable on the right, and the left side follows
you as you type.

```console
$ reader ~/Documents/self/therapy/journal
```

Opens <http://127.0.0.1:8734/>. `Ctrl-C` stops it. Nothing leaves your machine.

Run it again on another directory and that one gets the next free port
(8735, 8736, …), so each directory has its own tab. `--port` asks for one port
exactly.

## Asides

A line starting `~` is an **aside**: your own voice, set in a column of
its own beside the text, level with the line you were reacting to. It
doesn't change the shape of what it's written in: a list stays one list
with an aside between its items.

```markdown
I continue to mourn things that I loved being in the stream of.

~ Maybe a post about the music; go towards the music
```

Emoji shortcodes like `:tada:` show as 🎉 in the rendered pane but stay as
`:tada:` in the file. Code spans and unknown names are left as written.

`scripture:` makes a link to Blue Letter Bible, in the RSV unless a version
follows a comma:

| You write | Links to | Shows |
| --- | --- | --- |
| `scripture:[Isaiah 2:1-5]` | `blueletterbible.org/rsv/isaiah/2/1-5` | Isaiah 2:1-5 |
| `scripture:[Isaiah 2:1-5, NIV]` | `blueletterbible.org/niv/isaiah/2/1-5` | Isaiah 2:1-5, NIV |
| `scripture:isaiah/2/1-5[plowshares]` | `blueletterbible.org/rsv/isaiah/2/1-5` | plowshares |

As with emoji, the file keeps what you typed. References in code, and bracketed
text that doesn't read as `Book ch[:vs]`, are left as written.

`scripture-lds:` does the same for any of the standard works -- Bible, Book
of Mormon, Doctrine and Covenants, Pearl of Great Price -- on
churchofjesuschrist.org. Books go by their full names or the usual short ones
(`1 Ne`, `D&C`, `JS—H`, `A of F`):

| You write | Links to | Shows |
| --- | --- | --- |
| `scripture-lds:[D&C 88:26]` | `…/dc-testament/dc/88?lang=eng&id=p26#p26` | D&C 88:26 |
| `scripture-lds:[1 Nephi 3:7]` | `…/bofm/1-ne/3?lang=eng&id=p7#p7` | 1 Nephi 3:7 |
| `scripture-lds:[Articles of Faith 13]` | `…/pgp/a-of-f/1?lang=eng&id=p13#p13` | Articles of Faith 13 |
| `scripture-lds:dc/88/26[quickened]` | `…/dc-testament/dc/88?lang=eng&id=p26#p26` | quickened |

`rfc:` does the same for the RFC Editor. The brackets are required; left empty,
they read as the RFC's name:

| You write | Links to | Shows |
| --- | --- | --- |
| `rfc:9110[]` | `rfc-editor.org/rfc/rfc9110.html` | RFC 9110 |
| `rfc:9110#section-15.5[]` | `rfc-editor.org/rfc/rfc9110.html#section-15.5` | RFC 9110 §15.5 |
| `rfc:6749[OAuth 2.0]` | `rfc-editor.org/rfc/rfc6749.html` | OAuth 2.0 |

`search:` makes a Google search, for something to look into later. It shows
with a dotted underline and a ⌕. Spaces in the bracket become `+` in the
query, so these two are the same search:

| You write | Searches for | Shows |
| --- | --- | --- |
| `search:[commensality]` | commensality | commensality |
| `search:[My Many Worded Term]` | My+Many+Worded+Term | My Many Worded Term |
| `search:my+many+worded+term[My Many Worded Term]` | my+many+worded+term | My Many Worded Term |

`->`, `<-` and `<->` show as →, ← and ↔. A backslash (`\->`) keeps them as
typed.

`math:[…]` sets relations between ideas as symbols, keeping the words
upright. Alone on its line it is centered like an equation; within a sentence
it stays inline:

| You write | Shows |
| --- | --- |
| `>=` `<=` `!=` `~=` | ≥ ≤ ≠ ≈ |
| `>>` `<<` | ≫ ≪ |
| `->` `<-` `<->` | → ← ↔ |
| `*` `+-` `-` | × ± − |
| `.:` `inf` | ∴ ∞ |

```markdown
math:[recognition >> judgment]
```

A `-` joining two words (`self-worth`) stays a hyphen.

`Q:` and `A:` at the start of a line make an exchange, set apart from the
notes around it: the question in italics, the answer upright. A name in
parentheses shows beside the label. Another `A:` straight after an answer --
unnamed, or naming the same person -- continues it as a new paragraph, and the
same goes for `Q:`:

```markdown
Q (audience): Is this a pendulum swing or an integration?
A (Thomas): An integration.

A: The renaissance and the scientific revolution each had half of it.
A (Sarah): I'd say it's a spiral.
```

That is one answer from Thomas in two paragraphs, then one from Sarah. Any
line starting at the margin that isn't `Q:` or `A:` ends the exchange.

A backslash (`\A:`) keeps a line that happens to start that way as typed.

A line starting `@ ` is a **form field**: a label, a colon, and whatever's
filled in after it, which can be nothing yet.

```markdown
@ My Name: Josh
@ Date:
```

shows as

> **My Name:** Josh<br>
> **Date:** \_\_\_\_\_\_\_\_

with the value on a shaded blank. Each colon is a line of blank, so a longer
answer gets more room, running to the end of the line:

```markdown
@ Notes:::
```

shows as

> **Notes:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_<br>
> &emsp;&emsp;&emsp;&ensp;\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_<br>
> &emsp;&emsp;&emsp;&ensp;\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

The value still goes on the one line in the file, wrapping only on the page,
and a blank grows if it outruns its lines. Click the label, the blank, or
beside them to fill it in, right on the page: `Enter` (or clicking away)
writes it into the file, saved like typing; `Esc` puts it back; `Tab` and `⇧Tab` write it and
move to the next field or the one before. As with puzzles, this works in read
mode too. The value is shown just as typed, with no markdown.

A blockquote whose last line starts with `--` takes that line as its
attribution, set right-aligned under the quote. Links, and `scripture:`, work
there as anywhere:

```markdown
> The road of excess leads to the palace of wisdom.
> -- [William Blake](https://en.wikipedia.org/wiki/The_Marriage_of_Heaven_and_Hell)
```

Text can be colored and set in another font by naming the styles in braces
after it: `[this is red]{red}`, `[both]{darkgreen times-new-roman}`. A CSS
color name (`red`, `slategray`, `rebeccapurple`, ...) sets the color; any
other name is a font, with hyphens for spaces. A font you don't have falls
back to the page's own. For whole paragraphs, lists or tables, fence them with
`:::`:

```markdown
::: slategray georgia
Everything here is gray and in Georgia,

- lists and tables included,

until the closing line.
:::
```

A few GitHub conventions show as they do there:

- **Callouts.** A blockquote that opens with `[!NOTE]`, `[!TIP]`,
  `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]` becomes a box headed with 📝 💡
  ❗ ⚠️ or 🛑.

  ```markdown
  > [!WARNING]
  > my information
  ```

- **Tasks.** `- [ ] take out the trash` shows a checkbox, and `- [x]` a
  checked one. Clicking a box rewrites the `[ ]` in the file, as an ordinary
  (undoable) edit. `- ( )` and `- (x)` are radio buttons instead: only one in
  a list can be chosen, and choosing one clears the others' `(x)`.

- **Tables.** Pipe tables, with `:---:` and `---:` for alignment.

- **Figures.** An image alone in its paragraph gets a caption: its title if it
  has one, otherwise its alt text. `![a cat](cat.jpg "Ginger, 2019")` is
  captioned "Ginger, 2019".

- **Puzzles.** A fence named for a puzzle is drawn as the puzzle and can be
  played right on the page, in edit, read and present modes alike. The
  fence's text *is* the puzzle and the progress made on it: each move is
  written back into the file, saved like typing, so it's there next time and
  reads as plain text anywhere else. Click a puzzle (or Tab to it) to play;
  while it has focus it takes the keys, and `Esc` hands them back. `?` shows
  them. There are five so far: `sudoku`, `tracks`, `wordsearch`, `coord` and `maze`. A puzzle can sit in a quote or a list too.

  **Sudoku:**

  ~~~markdown
  ```sudoku
  5 3 . | . 7 . | . . .    5 3 4 | . 7 . | . . .
  6 . . | 1 9 5 | . . .    6 . . | 1 9 5 | . . .
  ------+-------+------    ------+-------+------
  ...
  notes: r1c4=26 r2c2=47
  ```
  ~~~

  Each row is the puzzle as given, then the board as played; givens can't be
  overwritten. Only digits and dots count, so the bars and rules are just for
  the eye, and a fresh puzzle can leave the board out. `notes:` holds pencil
  marks by row and column. A number repeated in a row, column or box shows
  red; a full board with none says so.

  | | |
  | --- | --- |
  | `←` `→` `↑` `↓` | move |
  | `1`–`9` | fill in a number (again to erase it) |
  | `⇧1`–`⇧9` | pencil mark |
  | `n` | pencil marks on / off |
  | `⌫` `0` | erase |

  **Train tracks:** one track from A to B, never branching or crossing
  itself; the numbers say how many squares in each column and row it runs
  through.

  ~~~markdown
  ```tracks
  2 2 8 8 8 6 5 0
  · · · · · · ┓ ·  5
  ┓ ─ ┐ ┗ · · · ·  7
  · · ╵ × · · · ·  6
  ...
  A: left 2  B: bottom 5
  ```
  ~~~

  The first line is the column counts, then each row of squares with its
  count, then the edge (`left`, `right`, `top`, `bottom`) and row or column
  where the track comes in and goes out. A square shows its track: heavy
  pieces (`━ ┃ ┏ ┓ ┗ ┛`) were given, light ones (`─ │ ┌ ┐ └ ┘`) were laid, a
  half piece (`╴ ╵ ╶ ╷`) is track laid in but not yet out, `×` is a square
  marked as having none, and `·` is undecided. A count turns green when its
  row or column has that many squares of track, red when it has more; a
  finished track says so.

  | | |
  | --- | --- |
  | `←` `→` `↑` `↓` | move |
  | `⇧` + arrow, or drag | lay track that way; again (or drag back) to pick it up |
  | `x`, or double-click | mark a square with no track |
  | `⌫` | clear a square |

  **Word search:**

  ~~~markdown
  ```wordsearch
  E B E L I E V E X
  H O N E S T Q R P
  ...
  words: ABLE, BELIEVE, HOLY GHOST, HONEST
  found: BELIEVE r1c2-r1c8, HONEST r2c1-r2c6
  marks: NEST r2c3-r2c6
  ```
  ~~~

  The letters a row to a line (the spaces between them are for the eye), the
  words to find, and those found so far, each with the row and column of its
  first and last letters. A word runs in a straight line in any of the eight
  directions; a space in a word isn't in the grid. A listed word, circled,
  is ringed in color and crossed off the list. Anything else circled -- a
  word that isn't listed, or the start of one that is -- stays ringed in
  gray under `marks:`, and goes when circled again, or when a listed word is
  found over it.

  | | |
  | --- | --- |
  | `←` `→` `↑` `↓` | move |
  | `Space` or `Enter` | start a word; again at its last letter to circle it |
  | drag, or click both ends | circle a word |
  | `⌫` | erase gray marks through this letter |
  | `Esc` | let go of a word |

  **Coordinate graph:** a mystery picture, drawn point by point.

  ~~~markdown
  ```coord
  grid: 20 x 24
  (3, 1) (17, 1) (17, 9) (3, 9) (3, 1)
  (2, 9) (18, 9) (17, 10) (3, 10) (2, 9)
  ...
  plotted: 7
  ```
  ~~~

  The grid's width and height, then the points, one pencil stroke to a line
  (START to STOP, as the list beside the graph shows them), then how many
  have been plotted, counting through the lines in order. Points are plotted
  in order: the pencil goes where it's moved, and the next point is drawn
  in, joined to the one before it, only if that's where it is. The axis
  numbers under the pencil light up, but finding the point is up to you.

  | | |
  | --- | --- |
  | `←` `→` `↑` `↓` | move the pencil; with `⇧`, five at a time |
  | `Space` or `Enter`, or click | plot the next point there |
  | `⌫` | take back the last point |

An image's size goes after its address as `=WxH`, in pixels, as in the
markdown-it-imsize convention. Leave one side out to keep the image's
proportions: `=100x` sets only the width, `=x200` only the height. A title
still goes before it.

```markdown
![](logo.svg =x200)
![a cat](cat.jpg "Ginger, 2019" =320x)
```

Everything else is ordinary markdown. Front matter (`Title`, `Author`, `Date`,
`Tags`, `Speaker`, `Listener`) becomes the masthead; without a `Title` the
file name is used. `Speaker` and `Listener` head the two columns.

## Reading and presenting

**Read** (`⌘.`) hides the file list and the editor and gives the rendered page
the whole window. Nothing can be typed into the file, but task checkboxes
and radio buttons still toggle, fields can be filled in, and puzzles can be played. `⌘.` or `Esc` goes back to editing. The mode is remembered.

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
- HTML comments are a slide's **speaker notes**. Don't put a `---` line in
  one: `slides` would split the slide there.
- Present opens on the slide under the cursor. If the file changes on disk
  while you present (say you fix a typo in vim), the deck reloads in place.

A slide comes in **one step at a time**. Each paragraph, quote, code block,
table or image is a step, and so is each list item, nested ones included, in
reading order. A slide's opening heading isn't a step: it shows with the
slide. An aside shows with the passage it sits beside. Steps not yet shown
keep their space, so the slide doesn't shift as they appear.

While presenting:

| | |
| --- | --- |
| `n` `→` `↓` `Space` `PageDown`, or click | next step; after the last one, the next slide |
| `p` `←` `↑` `PageUp`, or click the left third | back one step; before the first, the previous slide whole |
| `N` | the rest of this slide; if it's all showing, the next slide whole |
| `P` | the previous slide whole |
| `Home` / `End` | the first slide / the last slide whole |
| `T` | notes under the slide |
| `S` | speaker view: the current slide (steps to come drawn faintly), the next slide, notes, a timer, the time |
| `F` | full screen |
| `Esc` | stop presenting |

`n` and `p` undo each other exactly, so a clicker's back button takes back
what its forward button did.

A link to an image (`.png`, `.jpg`, `.gif`, `.webp`, `.svg`, `.avif`) shows
the image while you hover it, on a slide and in the rendered page:

```markdown
- Hi, I'm [Josh Cummings](images/bio-me.jpg)
```

The speaker view is its own window, so you can drag it to the laptop screen
and put the deck on the projector. Either window can change slides.


- Writes to disk about a second after you stop typing, and immediately on `⌘S`.
- Writes are atomic (temp file, then rename).
- If the file changed on disk since you opened it (say, in vim), the save is
  refused and a banner lets you **load the disk version** or **keep yours**.
  If you haven't typed anything, the app picks up outside edits quietly the
  next time its window gets focus.
- The previous version is copied to `<dir>/.reader/backups/<file>/` on every
  `⌘S` and at most every five minutes while autosaving. The last 10 are kept.

## Files

The sidebar lists `.md`, `.markdown` and `.pdf` files anywhere under the
directory, most recently modified first. It skips dot-directories and
`node_modules`. **New** creates a file named after today's date
(`2026-09-25.md`) unless you give it another name. If that file already exists,
it's opened instead. PDFs open read-only in the left pane.

Images and links in a note resolve relative to that note, so
`![](photo.jpg)` next to the file works.

## Keys

| | |
| --- | --- |
| `⌘S` | save now |
| `⌘B` `⌘I` `⌘K` | bold, italic, link |
| `Tab` | indent two spaces |
| `⌥↑` / `⌥↓` | previous / next file |
| `⌘\` | show / hide the file list |
| `⌘.` | read mode on / off |
| `⌘⇧.` | present as slides |

## Options

```console
$ reader [dir] [--port 8734] [--no-browser] [--open <file>]
```

`dir` defaults to the current directory. The server only listens on
`127.0.0.1`. It rejects requests addressed to any other host name, and any
path that would leave `dir`, including through symlinks.

## Install

Node 18+.

```console
$ cd ~/code/jzheaux/reader
$ npm install
$ npm link          # puts `reader` on your PATH
$ npm test
$ npm run lint
```

## Layout of the code

| | |
| --- | --- |
| `bin/reader.js` | CLI |
| `src/server.js` | HTTP API and static files |
| `src/content.js` | the content directory: listing, safe paths, saves, backups |
| `src/render.js` | markdown → `{css, body}` for the preview: one markdown-it, with every feature, laid out in columns |
| `src/columns.js` | the two-column layout: the speaker's passages beside the asides written against them, under the masthead |
| `features/` | one directory per piece of syntax: its markdown-it plugin, CSS, tests and, if it can be clicked, the `preview.js` that makes it so (so far: `asides`, `fields`, `tasks`, `qa`, `sizes`, `alerts`, `attributions`, `styles`, `scripture`, `scripture-lds`, `search`, `math`, `arrows`, `emoji`, `puzzles`) |
| `src/slides.js` | a `slides`-format deck → rendered slides and their notes |
| `static/app.js` | sidebar, editor, live preview, autosave, PDF view, read mode, deck |
| `static/preview.html` | the sandboxed preview frame |
| `static/preview-api.js` | what the frame offers the scripts drawn into it: `Preview.edit`, `Preview.register` |
| `static/preview.js` | the frame itself: rendering, slide steps, image peeks, shortcuts |
| `static/edits.js` | edits the preview asks for, checked against the lines they were drawn from |
| `features/puzzles/` | puzzle fences: found and wrapped (`index.js`), drawn, played and posted back in the preview (`preview.js`) |
| `features/puzzles/kinds/` | one file per kind of puzzle; a file here is a fence name |
| `static/speaker.html` | the speaker view for a deck being presented |

PDF.js is vendored in `static/vendor/`; its version and license are noted there.
