/**
 * Markdown (with `~` asides) -> { css, body } for the preview pane.
 *
 * One markdown-it parses every document: gutter-md's asides and front
 * matter, then each feature's plugin. gutter-md lays the tokens out in its
 * two columns, and the preview iframe, loaded once, has its style and body
 * swapped for these on every keystroke.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { gutterMd, columns } from 'gutter-md';
import { FEATURES } from '../features/index.js';

// Asides are kept out of the speaker's tokens (`inline: false`), for the
// columns to place beside them. Features that read the file as written go
// before this file's own source pass, `expand`; the rest after it.
const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: false }).use(gutterMd, { inline: false });
for (const f of FEATURES.filter((f) => f.plugin && f.raw)) md.use(f.plugin);
md.core.ruler.before('aside_extract', 'reader_expand', (state) => {
  if (!state.inlineMode && !state.env.__aside) state.src = expand(state.src);
});
for (const f of FEATURES.filter((f) => f.plugin && !f.raw)) md.use(f.plugin);

/**
 * `line` is the line of the file `src` starts on, when it is only part of
 * one (a slide), so whatever is written back by line number finds its line.
 */
export function render(src, { file, puzzleBase = 0, read, line = 0 } = {}) {
  const text = src || '';
  const env = { lineBase: line };
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
  const played = puzzles(body, puzzleBase, fences(text, { file, read, line }));
  return {
    css: [page.css.trim(), CSS, ...FEATURES.map((f) => f.css).filter(Boolean)].join('\n'),
    body: played.html,
    asides: asides.length,
    puzzles: played.count,
  };
}

// Fences naming a puzzle: one for each static/puzzles/<kind>.js, which draws
// and plays it. The server loads them all into the preview.
export const PUZZLE_DIR = fileURLToPath(new URL('../static/puzzles/', import.meta.url));
export const PUZZLES = new Set(
  fs.readdirSync(PUZZLE_DIR).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -'.js'.length)).sort(),
);
const PUZZLE_CODE = /<pre><code class="language-([\w-]+)">[\s\S]*?<\/code><\/pre>/g;
const PUZZLE_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)[ \t]*([^`]*?)[ \t]*$/;

/**
 * A fenced block naming a puzzle (```sudoku) is wrapped for the preview to
 * draw and play, numbered in document order from `base` so the preview can
 * tell it's the same puzzle after a re-render. The text stays inside, as
 * written, and `data-from` and `data-to` say which lines of the file it is
 * (from the first inside the fence up to the closing one), for a move to be
 * written back to.
 *
 * A puzzle can keep its board in a file of its own, named after the kind
 * (```maze mazes/one.maze), so a big one doesn't fill the page; the fence
 * then holds only what's been played. The file's text (or why it couldn't
 * be read) is carried along for the preview to put in front of the fence's.
 */
export function puzzles(html, base = 0, fences = []) {
  let n = base;
  let k = 0;
  const out = html.replace(PUZZLE_CODE, (m, kind) => {
    if (!PUZZLES.has(kind)) return m;
    const f = fences[k++];
    const lines = f ? ` data-from="${f.from}" data-to="${f.to}"` : '';
    const source = !f?.source ? ''
      : f.source.error ? ` data-source-error="${escapeAttr(f.source.error)}"`
        : ` data-source="${escapeAttr(f.source.text)}"`;
    return `<div class="puzzle" data-kind="${kind}" data-puzzle="${n++}"${lines}${source}>${m}</div>`;
  });
  return { html: out, count: n - base };
}

/**
 * Each puzzle fence in `text`, in order: { from, to, source }. `from` and `to`
 * are the lines inside it, counting from `line`; `to` is the closing fence,
 * or the end of the text if it was never closed. `source` is null for a
 * fence that names no board file, else { text } or { error }. A file is
 * found next to the document `file`, and read with `read(path)` (paths from
 * the content root).
 */
export function fences(text, { file, read, line = 0 } = {}) {
  const out = [];
  const lines = text.split('\n');
  let fence = null;
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const f = PUZZLE_FENCE.exec(lines[i]);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && !f[2] && !f[3]) {
        fence = null;
        if (open) open.to = line + i;
        open = null;
      }
      continue;
    }
    if (!f) continue;
    fence = f[1];
    if (!PUZZLES.has(f[2])) continue;
    // Never closed, it runs to the end of the text, short of the empty line
    // after a last newline, which markdown leaves out of the code.
    const end = lines.at(-1) === '' ? lines.length - 1 : lines.length;
    open = { from: line + i + 1, to: line + end, source: board(f[3], file, read) };
    out.push(open);
  }
  return out;
}

function board(ref, file, read) {
  if (!ref) return null;
  const rel = path.posix.normalize(path.posix.join(path.posix.dirname(file || ''), ref));
  try {
    if (!read) throw new Error('no files to read from');
    return { text: read(rel).replace(/\r\n?/g, '\n').replace(/\n+$/, '') };
  } catch (err) {
    return { error: `${ref}: ${err.message}` };
  }
}

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

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
