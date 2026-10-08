/**
 * Markdown (with `~` asides) -> { css, body } for the preview pane.
 *
 * One markdown-it parses every document, with each feature's plugin
 * (features/), asides and front matter among them. columns.js lays the
 * tokens out in two columns, and the preview iframe, loaded once, has its
 * style and body swapped for these on every keystroke.
 */

import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { columns } from './columns.js';
import { FEATURES } from '../features/index.js';

// Features that read the file as written (and asides) go before this file's
// own source pass, `expand`; the rest after it.
const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: false });
for (const f of FEATURES.filter((f) => f.plugin && f.raw)) md.use(f.plugin);
md.core.ruler.before('aside_extract', 'reader_expand', (state) => {
  if (!state.inlineMode && !state.env.__aside) state.src = expand(state.src);
});
for (const f of FEATURES.filter((f) => f.plugin && !f.raw)) md.use(f.plugin);
md.core.ruler.push('reader_lines', (state) => {
  if (state.env.lines && !state.inlineMode && !state.env.__aside) markLines(state.tokens, state.env);
});

/**
 * `line` is the line of the file `src` starts on, when it is only part of
 * one (a slide), so whatever is written back by line number finds its line.
 * `file` is the document's path, and `read(path)` reads another file from
 * the content directory, for features that may (a puzzle's board). `shared`
 * is kept by features across the renders of one document's parts (a deck's
 * slides), to number things through the whole of it. `asideKey` is the
 * aliases its asides may use when `src` doesn't declare its own (a deck's,
 * for one slide of it). `lines` marks each block with the line of the file
 * it was drawn from, `data-line`, for scrolling in step with the editor.
 */
export function render(src, { file, read, line = 0, shared = {}, asideKey, lines = false } = {}) {
  const text = src || '';
  const env = { lineBase: line, file, read, shared, asideKey, lines };
  const tokens = md.parse(text, env);
  const meta = env.frontMatter || {};
  const asides = env.asides || [];

  // Column headings ("Speaker" / "Listener") only help when the document
  // names its voices; a journal entry doesn't need them.
  const headings = Boolean(asides.length && (meta.speaker || meta.listener));
  const title = meta.title || (file ? path.basename(file, path.extname(file)) : 'Untitled');

  const page = columns(md, tokens, env, { headings, title });
  // Then each feature's pass over the finished page, if it has one.
  const body = FEATURES.reduce((html, f) => (f.html ? f.html(html) : html), figures(page.body.trim()));
  return {
    css: [page.css.trim(), CSS, ...FEATURES.map((f) => f.css).filter(Boolean)].join('\n'),
    body,
    asides: asides.length,
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
 * `data-line`, 0-based. Token maps count lines of what the asides feature
 * left, so they're traced back through `env.sourceLines`. Asides aren't
 * marked: they're parsed apart, and set beside the line they follow.
 */
function markLines(tokens, env) {
  const base = env.lineBase ?? 0;
  for (const t of tokens) {
    if (!t.block || !t.map || t.nesting < 0 || t.type === 'inline') continue;
    t.attrSet('data-line', String(base + (env.sourceLines?.[t.map[0]] ?? t.map[0])));
  }
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const CODE_SPAN = /(`+)[^`][\s\S]*?\1|`+/g;

const RFC = /(?<![\w\\])rfc:(\d{1,5})(?:#([\w.-]+))?\[([^\]\n]*)\]/g;
const RFC_EDITOR = 'https://www.rfc-editor.org/rfc';

/**
 * The source-level pass, run before markdown sees the text:
 *
 * - `rfc:9110[]` and `rfc:9110#section-15.5[]` -> links to the RFC Editor,
 *   labelled "RFC 9110" and "RFC 9110 §15.5" unless the brackets say otherwise.
 *
 * Like shortcodes, the source keeps what was typed, and code is left alone.
 * Line numbers are preserved. It runs as a markdown-it core rule, after the
 * features that read the file as written.
 */
export function expand(src) {
  let fence = null;
  const lines = src.split('\n');
  return lines.map((line) => {
    const f = FENCE.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      return line;
    }
    if (f) {
      fence = f[1];
      return line;
    }
    return outsideCode(line, (text) => text
      .replace(RFC, (m, num, anchor, label) => mdLink(rfcLink(num, anchor, label))));
  }).join('\n');
}

function mdLink({ label, href }) {
  return `[${label.replace(/[[\]\\]/g, '\\$&')}](${href})`;
}

export function rfcLink(num, anchor, label) {
  const n = String(Number(num));
  const text = label.trim();
  const href = `${RFC_EDITOR}/rfc${n}.html${anchor ? `#${anchor}` : ''}`;
  if (text) return { href, label: text };
  const section = anchor && /^(section|appendix)-(.+)$/i.exec(anchor);
  if (!section) return { href, label: `RFC ${n}` };
  const where = section[1].toLowerCase() === 'section' ? `§${section[2]}` : `Appendix ${section[2]}`;
  return { href, label: `RFC ${n} ${where}` };
}



const FIGURE = /<p>(<img src="[^"]*" alt="([^"]*)"(?: title="([^"]*)")?(?: style="[^"]*")?>)<\/p>/g;

/**
 * An image alone in its paragraph becomes a figure, captioned by its title,
 * or failing that its alt text: `![a cat](cat.jpg "Ginger, 2019")`.
 */
export function figures(html) {
  return html.replace(FIGURE, (m, img, alt, title) => {
    const caption = title || alt;
    return caption
      ? `<figure>${img}<figcaption>${caption}</figcaption></figure>`
      : `<figure>${img}</figure>`;
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
  background: #f5f3ef;
}
tbody tr:nth-child(even) td { background: #faf9f7; }


`;

function outsideCode(line, fn) {
  let out = '';
  let pos = 0;
  for (const m of line.matchAll(CODE_SPAN)) {
    out += fn(line.slice(pos, m.index)) + m[0];
    pos = m.index + m[0].length;
  }
  return out + fn(line.slice(pos));
}
