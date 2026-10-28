/**
 * Markdown (with `~` asides) -> { css, body, title } for the preview pane.
 *
 * One markdown-it parses every document, its front matter and comments
 * taken off first (page.js), then with each feature's plugin (features/),
 * asides among them. columns.js lays the
 * tokens out in two columns, and the preview iframe, loaded once, has its
 * style and body swapped for these on every keystroke.
 */

import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { columns } from './columns.js';
import { readBackground, backdrop, CSS as BACKGROUND_CSS } from './background.js';
import { fontCss } from './fonts.js';
import { FEATURES } from '../features/index.js';
import { page as pageRule } from './page.js';

// Features that read the file as written go before the rest, their rules
// before the page's front matter and comments come off.
const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: false });
md.use(pageRule);
for (const f of FEATURES.filter((f) => f.plugin && f.raw)) md.use(f.plugin);
for (const f of FEATURES.filter((f) => f.plugin && !f.raw)) md.use(f.plugin);
// A `late` plugin, which reads what all of them leave as text (the words an
// aside chooses), goes after.
for (const f of FEATURES.filter((f) => f.late)) md.use(f.late);
md.core.ruler.push('reader_lines', (state) => {
  if (state.env.lines && !state.inlineMode && !state.env.__aside) markLines(state.tokens, state.env);
});

/**
 * A document's title: the one its front matter names, or else its file's
 * name, as the editor shows it. A document with neither is `Untitled`.
 */
export function titleOf(meta, file) {
  return meta?.title || (file ? path.basename(file, path.extname(file)) : 'Untitled');
}

/**
 * `line` is the line of the file `src` starts on, when it is only part of
 * one (a slide), so whatever is written back by line number finds its line.
 * `file` is the document's path, and `read(path)` reads another file from
 * the content directory, for features that may (a puzzle's board). `shared`
 * is kept by features across the renders of one document's parts (a deck's
 * slides), to number things through the whole of it. `entries` are the
 * front matter lines features claimed (page.js), for when `src` has none
 * of its own (a deck's, for one slide of it). `lines` marks each block with the line of the file
 * it was drawn from, `data-line`, for scrolling in step with the editor.
 * `background` is what's behind the page (see background.js) when it isn't
 * the front matter's to say: a slide's own, or its deck's, or null for none.
 * `fonts` is likewise the front matter that names the fonts (see fonts.js):
 * a slide's deck's. `matter` is the front matter of the document `src` is
 * a part of, for the settings a slide takes from its deck (the names of a
 * staged box's stages, features/tasks). `drawn` is what the preview frame
 * drew of the page, by feature (`{ mermaid: { text: svg } }`), to set into
 * it where the page will have nothing to draw it (export.js). `exported` is for a page that will
 * run no script of the app's, so draws nothing that would wait on one. `deck` is for a slide
 * being presented, where the deck keeps the page's fields shut.
 */
export function render(src, { file, read, line = 0, shared = {}, entries, lines = false, background, fonts, matter, drawn, exported = false, deck = false } = {}) {
  const text = src || '';
  const env = { lineBase: line, file, read, shared, entries, lines, matter, drawn, exported, deck };
  const tokens = md.parse(text, env);
  const meta = env.frontMatter || {};
  const asides = env.asides || [];

  // Column headings ("Speaker" / "Listener") only help when the document
  // names its voices; a journal entry doesn't need them.
  const headings = Boolean(asides.length && (meta.speaker || meta.listener));
  const title = titleOf(meta, file);

  const page = columns(md, tokens, env, { headings, title });
  // Then each feature's pass over the finished page, if it has one.
  const body = FEATURES.reduce((html, f) => (f.html ? f.html(html) : html), figures(page.body.trim()));
  const behind = backdrop(background === undefined ? readBackground(meta.background) : background);
  return {
    // The document's fonts last, over the theme's and under a `:::` block's own.
    css: [page.css.trim(), CSS, BACKGROUND_CSS, ...FEATURES.map((f) => f.css).filter(Boolean), fontCss(fonts ?? meta)].filter(Boolean).join('\n'),
    body: behind + body,
    asides: asides.length,
    title,
  };
}

/**
 * A slide's speaker notes, rendered by the same markdown as the page, but
 * as plain HTML, without its columns: they're read at a glance, mid-talk.
 */
export function renderNotes(src) {
  return src ? md.render(src, { lineBase: 0, shared: {} }).trim() : '';
}

/**
 * Each block that opens on a line of its own gets that line of the file as
 * `data-line`, 0-based. Token maps count lines of what's left once the
 * front matter, comments and asides are off, so they're traced back through `env.sourceLines`. Asides aren't
 * marked: they're parsed apart, and set beside the line they follow.
 */
function markLines(tokens, env) {
  const base = env.lineBase ?? 0;
  for (const t of tokens) {
    if (!t.block || !t.map || t.nesting < 0 || t.type === 'inline') continue;
    t.attrSet('data-line', String(base + (env.sourceLines?.[t.map[0]] ?? t.map[0])));
  }
}

const FIGURE = /<p((?: data-line="\d+")?)>(<img src="[^"]*" alt="([^"]*)"(?: title="([^"]*)")?(?: style="[^"]*")?>)<\/p>/g;

/**
 * An image alone in its paragraph becomes a figure, captioned by its title,
 * or failing that its alt text: `![a cat](cat.jpg "Ginger, 2019")`. The
 * figure keeps its paragraph's line, when it was marked with one.
 */
export function figures(html) {
  return html.replace(FIGURE, (m, line, img, alt, title) => {
    const caption = title || alt;
    return caption
      ? `<figure${line}>${img}<figcaption>${caption}</figcaption></figure>`
      : `<figure${line}>${img}</figure>`;
  });
}

const CSS = `
figure { margin: 0.8rem 0; }
figure img { display: block; max-width: 100%; height: auto; }
figcaption {
  font-family: var(--gm-sans);
  font-size: 0.82rem;
  color: var(--gm-ink-soft);
  margin-top: 0.35rem;
}
img { max-width: 100%; }



table { margin: 0.8rem 0; }
th {
  font-family: var(--gm-sans);
  font-size: 0.88em;
  font-weight: 600;
  background: var(--gm-th);
}
tbody tr:nth-child(even) td { background: var(--gm-stripe); }


`;
