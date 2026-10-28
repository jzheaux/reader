/**
 * Markdown -> a deck of rendered slides, in the format of
 * https://github.com/maaslalani/slides, so one file presents both in the
 * terminal and here:
 *
 *   ---                      optional front matter (author, date, paging, ...)
 *   author: Josh
 *   background: paper.jpg    behind every slide (background.js)
 *   font: avenir-next        the deck's type (fonts.js)
 *   ---
 *
 *   # First slide
 *
 *   <!-- speaker notes -->
 *   <!-- background: navy -->    behind this slide instead
 *   <!-- transition: up -->      how this slide leaves for the next (transition.js)
 *
 *   ---
 *
 *   # Second slide
 *
 * A line that is exactly `---` ends a slide, unless it is inside a code fence.
 * A slide's opening heading is its title, kept at the top (`.slide-title`),
 * and the rest (`.slide-body`) sits in the middle of what's left, both ways;
 * a slide of headings only, a title slide (`.slide-cover`), is centered
 * whole. One quote, image, headline or line of math alone under the title
 * is centered across the slide too.
 *
 * HTML comments are lifted out of a slide as its speaker notes: `slides`
 * sanitizes them away, so they never show in the terminal either. That
 * makes the notes the place for what reader is told about one slide: a
 * `key: value` line there is read and taken out of the notes shown (its
 * `background:` here, its `transition:`, its `at:` and `time:` in pacing.js).
 *
 * The same file is a workbook when it's worked through and not presented
 * (`pages`): each slide a page of the document, at the size it's written.
 */

import { render, renderNotes, titleOf } from './render.js';
import { readNotes, plan, planEnd, duration } from './pacing.js';
import { readBackground, liftBackground } from './background.js';
import { readTransition, liftTransition } from './transition.js';
import { frontMatter, fenced } from '../static/markdown.js';
import { matterEntry } from './page.js';

const SEPARATOR = /^---[ \t]*$/;
const NOTE = /<!--([\s\S]*?)-->/g;

/** Is there a slide break in `src` after its front matter? */
export function isDeck(src) {
  return split(src).slides.length > 1;
}

export function slides(src, { file, read } = {}) {
  const { meta, entries, slides: chunks } = split(src);
  const title = titleOf(meta, file);
  let css = '';
  const out = [];
  // Kept by features across the slides, to number things through the deck.
  const shared = {};
  const behind = readBackground(meta.background);
  const leaving = readTransition(meta.transition) ?? 'none';
  for (const { text, line } of chunks) {
    const lifted = lift(text);
    if (!lifted.body.trim() && !lifted.notes) continue;
    const own = liftBackground(lifted.notes);
    const moved = liftTransition(own.notes);
    const { notes, at, budget } = readNotes(moved.notes);
    const r = render(lifted.body, { file, read, line, shared, entries, background: own.background ?? behind, fonts: meta, matter: meta, deck: true });
    css ||= `${r.css}\n${CSS}`;
    out.push({ body: titled(unmast(r.body), lifted.body), notes, notesHtml: renderNotes(notes), line, at, budget, transition: moved.transition ?? leaving });
  }
  // When each slide should start, by the notes' checkpoints and budgets.
  const total = duration(meta.time);
  const starts = plan(out, total);
  out.forEach((s, i) => { s.plan = starts[i]; });
  return { css: css || CSS, title, meta, slides: out, end: planEnd(out, starts, total) };
}

/**
 * A deck as a workbook's pages: each slide drawn as a document is, not as a
 * stage, with nothing of the slide's notes. `line` is where the page starts
 * in the file, and, unless `lines` is false, its blocks carry theirs
 * (`data-line`). `drawn` and `exported` are as render() takes them.
 */
export function pages(src, { file, read, lines = true, drawn, exported } = {}) {
  const { meta, entries, slides: chunks } = split(src);
  let css = '';
  const out = [];
  const shared = {};
  const title = titleOf(meta, file);
  const behind = readBackground(meta.background);
  for (const { text, line } of chunks) {
    const lifted = lift(text);
    if (!lifted.body.trim()) continue;
    const own = liftBackground(lifted.notes);
    const r = render(lifted.body, { file, read, line, shared, entries, background: own.background ?? behind, fonts: meta, matter: meta, lines, drawn, exported });
    css ||= r.css;
    out.push({ body: unmast(r.body), line });
  }
  return { css, title, meta, pages: out };
}

/**
 * Cuts `src` into slides, each with the 0-based line it starts on, after
 * its front matter (static/markdown.js). Lines a feature claims there
 * (`reviewer #: Josh`, page.js) are the deck's `entries`, not its meta.
 */
export function split(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const matter = frontMatter(lines, { entry: matterEntry });
  const out = [];
  const code = fenced();
  let start = matter?.end ?? 0;
  for (let i = start; i <= lines.length; i++) {
    if (i === lines.length || (!code(lines[i]) && SEPARATOR.test(lines[i]))) {
      out.push({ text: lines.slice(start, i).join('\n'), line: start });
      start = i + 1;
    }
  }
  return { meta: matter?.meta ?? {}, entries: matter?.entries ?? [], slides: out.filter((s) => s.text.trim()) };
}

/**
 * Separates a slide's speaker notes (its HTML comments) from its content. A
 * note leaves its line breaks behind, so each line of the content is still
 * on the line it was in the file.
 */
export function lift(text) {
  const notes = [];
  const lines = text.split('\n');
  const code = fenced();
  // Only comments outside code fences are notes; mask the fenced lines first.
  const masked = lines.map((l) => (code(l) ? '\0'.repeat(l.length) : l)).join('\n');

  let body = '';
  let last = 0;
  for (const m of masked.matchAll(NOTE)) {
    body += text.slice(last, m.index) + m[0].replace(/[^\n]/g, '');
    notes.push(dedent(m[1]));
    last = m.index + m[0].length;
  }
  body += text.slice(last);
  return { body, notes: notes.filter(Boolean).join('\n\n') };
}

function dedent(s) {
  const lines = s.replace(/^\n+|\s+$/g, '').split('\n');
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)[0].length));
  return lines.map((l) => l.slice(Number.isFinite(pad) ? pad : 0)).join('\n').trim();
}

/** A slide is not a document: drop the title masthead the layout puts on top. */
function unmast(body) {
  return body.replace(/<header class="gm-masthead">[\s\S]*?<\/header>\s*/, '');
}

const PAIR = '<section class="gm-pair">\n<div class="gm-speaker">\n';
const OPENING = /<(h[1-6])\b[^>]*>[\s\S]*?<\/\1>\n?/y;
// What's left of a row that held only the title.
const EMPTY = `${PAIR}</div>\n<div></div>\n</section>\n`;
const HEADING_LINE = /^[ \t]*(?:#{1,6}[ \t]|:::)/;
const DOC = '<div class="gm-doc">';

/**
 * Sets a slide's opening heading apart from the rest of it, as
 * `.slide-title` above `.slide-body`, for the stylesheet to keep one at the
 * top and center the other; a slide with no opening heading is all body.
 * `src` is the slide as written: one that's all headings is a cover
 * (`.slide-cover`), to be centered whole.
 */
function titled(body, src) {
  if (src.split('\n').every((l) => !l.trim() || HEADING_LINE.test(l))) return body.replace(DOC, '<div class="gm-doc slide-cover">');
  const at = body.indexOf(PAIR);
  if (at < 0) return body;
  const end = body.lastIndexOf('</div>');
  OPENING.lastIndex = at + PAIR.length;
  const heading = OPENING.exec(body);
  if (!heading) return `${body.slice(0, at)}<div class="slide-body">\n${body.slice(at, end)}</div>\n</div>`;
  let rest = PAIR + body.slice(OPENING.lastIndex, end);
  if (rest.startsWith(EMPTY)) rest = rest.slice(EMPTY.length);
  return `${body.slice(0, at)}<header class="slide-title">\n${heading[0].trim()}\n</header>\n<div class="slide-body">\n${rest}</div>\n</div>`;
}

// Scaled to the window, and centered on it, like a projected slide. The
// `:root` prefix outranks the preview frame's own pane-sized rules.
const CSS = `
/* by the window's width, or its height when it's wider than 16:9: it fills
   a screen as a slide does; times the deck's own text size (⌘+ and ⌘−),
   since the browser's zoom only makes the window smaller */
:root { --gm-base: calc(clamp(14px, min(2.1vw, 3.73vh), 40px) * var(--reader-text-scale, 1)); }
:root body { overflow: hidden; }
:root .gm-doc {
  max-width: none; min-height: 100vh; margin: 0;
  padding: 6vh 8vw;
  display: flex; flex-direction: column; justify-content: safe center;
}
:root .gm-doc h1 { font-size: 2.6rem; line-height: 1.12; margin: 0 0 0.5em; }
:root .gm-doc h2 { font-size: 1.9rem; line-height: 1.15; margin: 0 0 0.6em; }
:root .gm-doc pre { font-size: 0.8rem; }
:root .gm-doc:not(:has(.gm-asides)) .gm-pair { grid-template-columns: 1fr; }
/* the title at the top, the rest in the middle of what's left */
:root .slide-body { flex: 1; display: flex; flex-direction: column; justify-content: safe center; }
:root .slide-title > * { margin-top: 0; }
/* and in the middle across, as a block, when it's text, lists, quotes,
   code, tables and images: a short list's bullets sit in the middle,
   still in line with each other. A form, a puzzle, columns or asides keep
   the slide's width. */
:root .gm-doc:not(:has(.gm-asides, .field:not(.field-inline))) .slide-body:not(:has(> .gm-pair > .gm-speaker > :not(p, ul, ol, blockquote, pre, table, figure, hr, h1, h2, h3, h4, h5, h6, .headline, .number))) {
  align-self: center; width: fit-content; max-width: 100%;
}
/* a cover, all headings, is centered across as well as down */
:root .slide-cover { text-align: center; }
:root .slide-title h3, :root .slide-title h4 { font-size: 1.4rem; }
/* one quote, image, headline, number or line of math alone on a slide: centered across it too */
:root .gm-pair:only-of-type > .gm-speaker > :only-child:is(figure, blockquote:not(.alert), .headline, .number) {
  width: fit-content; max-width: min(100%, 34em); margin-left: auto; margin-right: auto;
}
:root .gm-pair:only-of-type > .gm-speaker > figure:only-child { max-width: 100%; }
:root .gm-pair:only-of-type > .gm-speaker > figure:only-child img { max-height: 64vh; object-fit: contain; margin: 0 auto; }
:root .gm-pair:only-of-type > .gm-speaker > figure:only-child figcaption { text-align: center; }
:root .gm-pair:only-of-type > .gm-speaker > p.math-display:only-child { font-size: 1.6em; }
`;
