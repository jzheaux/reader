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
import EMOJI from 'markdown-it-emoji/lib/data/full.mjs';
import { ldsLink } from './lds.js';
import { FEATURES } from '../features/index.js';

// Asides are kept out of the speaker's tokens (`inline: false`), for the
// columns to place beside them. Features that read the file as written go
// before this file's own source pass, `expand`; the rest after it.
const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: false }).use(gutterMd, { inline: false });
for (const f of FEATURES.filter((f) => f.raw)) md.use(f.plugin);
md.core.ruler.before('aside_extract', 'reader_expand', (state) => {
  if (!state.inlineMode && !state.env.__aside) state.src = expand(state.src);
});
for (const f of FEATURES.filter((f) => !f.raw)) md.use(f.plugin);

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
  const body = emojify(maths(searches(quotes(alerts(figures(sizes(page.body.trim())))))));
  const played = puzzles(body, puzzleBase, fences(text, { file, read, line }));
  return {
    css: [page.css.trim(), CSS, ...FEATURES.map((f) => f.css)].join('\n'),
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

const SHORTCODE = /:([a-z0-9_+-]+):/gi;
const RAW = new Set(['code', 'pre']);

/**
 * `:tada:` -> 🎉 in rendered text. The source keeps the shortcode; only the
 * preview shows the emoji. Tags and attributes are left alone, and so is
 * anything inside <code> or <pre>, where the colons are meant literally.
 * Unknown names stay as written.
 */
export function emojify(html) {
  let raw = 0;
  return html.replace(/(<[^>]*>)|([^<]+)/g, (m, tag, text) => {
    if (tag) {
      const t = /^<(\/?)([a-z0-9]+)/i.exec(tag);
      if (t && RAW.has(t[2].toLowerCase())) raw = Math.max(0, raw + (t[1] ? -1 : 1));
      return tag;
    }
    if (raw) return text;
    return text.replace(SHORTCODE, (code, name) => EMOJI[name.toLowerCase()] ?? code);
  });
}

const BLB = 'https://www.blueletterbible.org';
const DEFAULT_VERSION = 'rsv';
const SCRIPTURE = /(?<![\w\\])scripture:([\w/.:-]*)\[([^\]\n]*)\]/g;
const WITH_VERSION = /^(.+?)(?:\s*,\s*([a-z0-9]+))?$/i;
const REFERENCE = /^((?:[1-3]\s*)?[a-z][a-z .]*?)\s+(\d+)(?::([\d\s,\-\u2013]+))?$/i;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const CODE_SPAN = /(`+)[^`][\s\S]*?\1|`+/g;

const SCRIPTURE_LDS = /(?<![\w\\])scripture-lds:([\w/.:-]*)\[([^\]\n]*)\]/g;

const SEARCH = /(?<![\w\\])search:([^\s[\]]*)\[([^\]\n]*)\]/g;
const GOOGLE = 'https://www.google.com/search?q=';

const RFC = /(?<![\w\\])rfc:(\d{1,5})(?:#([\w.-]+))?\[([^\]\n]*)\]/g;
const RFC_EDITOR = 'https://www.rfc-editor.org/rfc';

// A quote's `--` becomes a marker at the head of its attribution.
const BYLINE = '\uE007';

// An image's size rides through markdown at the head of its title, between
// these markers, for `sizes` to take back out.
const SIZE_OPEN = '\uE00E';
const SIZE_CLOSE = '\uE00F';
const IMG_SIZE = /!\[([^\]\n]*)\]\([ \t]*(<[^>\n]*>|[^\s()]+)(?:[ \t]+("[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?[ \t]+=(\d*)x(\d*)[ \t]*\)/g;

// `math:[…]` is carried as open and close markers, the open one saying
// whether it stood alone on its line.
const MATH_INLINE = '\uE00A';
const MATH_DISPLAY = '\uE00B';
const MATH_CLOSE = '\uE00C';
const MATH = /(?<![\w\\])math:\[([^\]\n]*)\]/g;
const MATH_ALONE = /^[ \t]*math:\[[^\]\n]*\][ \t]*$/;

const ATTRIBUTION = /^([ \t]*(?:~[ \t]*)*(?:>[ \t]*)+)(?:--|\u2014)[ \t]+(?=\S)/;
const QUOTED = /^[ \t]*(?:~[ \t]*)*>/;

/**
 * The source-level pass, run before markdown sees the text:
 *
 * - `scripture:[Isaiah 2:1-5]`, `scripture:[Isaiah 2:1-5, NIV]` and
 *   `scripture:isaiah/2/1-5[plowshares]` -> links to Blue Letter Bible, RSV
 *   unless a version follows a comma. A bracketed reference that doesn't read
 *   as `Book ch[:vs]` is left alone.
 * - `scripture-lds:[D&C 88:26]` and `scripture-lds:dc/88/26[label]` -> the
 *   same for any of the standard works, on churchofjesuschrist.org.
 * - `rfc:9110[]` and `rfc:9110#section-15.5[]` -> links to the RFC Editor,
 *   labelled "RFC 9110" and "RFC 9110 §15.5" unless the brackets say otherwise.
 * - `search:[many worded term]` and `search:many+worded+term[label]` -> a
 *   Google search, marked as something still to look into.
 * - `->`, `<-` and `<->` -> arrows.
 * - `math:[recognition >> judgment]` -> an expression, its operators set as
 *   symbols; alone on its line, it is displayed like an equation.
 * - `> -- Author` closing a blockquote -> that quote's attribution.
 * - `![alt](img.png =100x200)`, `=100x` or `=x200` -> an image of that size
 *   in pixels, a missing side scaled to keep its proportions. `sizes` sets it.
 *
 * Like shortcodes, the source keeps what was typed, and code is left alone.
 * Line numbers are preserved. It runs as a markdown-it core rule, after the
 * features that read the file as written.
 */
export function expand(src) {
  let fence = null;
  const lines = src.split('\n');
  return lines.map((line, n) => {
    const f = FENCE.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      return line;
    }
    if (f) {
      fence = f[1];
      return line;
    }
    const alone = MATH_ALONE.test(line);
    const next = lines[n + 1];
    if (next === undefined || !QUOTED.test(next)) line = line.replace(ATTRIBUTION, `$1${BYLINE}`);
    return outsideCode(line, (text) => text
      .replace(IMG_SIZE, (m, alt, src, title, w, h) => {
        if (!w && !h) return m;
        const inner = title ? title.slice(1, -1).replace(/\\?"/g, '\\"') : '';
        return `![${alt}](${src} "${SIZE_OPEN}${w}x${h}${SIZE_CLOSE}${inner}")`;
      })
      .replace(MATH, (m, expr) => `${alone ? MATH_DISPLAY : MATH_INLINE}${math(expr)}${MATH_CLOSE}`)
      .replace(SCRIPTURE_LDS, (m, p, label) => {
        const link = ldsLink(p, label);
        return link ? mdLink(link) : m;
      })
      .replace(SCRIPTURE, (m, p, label) => {
        const link = scriptureLink(p, label);
        return link ? mdLink(link) : m;
      })
      .replace(RFC, (m, num, anchor, label) => mdLink(rfcLink(num, anchor, label)))
      .replace(SEARCH, (m, q, label) => {
        const link = searchLink(q, label);
        return link ? mdLink(link) : m;
      })
      .replace(/(?<!\\)<->/g, '\u2194')
      .replace(/(?<![-<\\])->/g, '\u2192')
      .replace(/(?<!\\)<-(?![-<>])/g, '\u2190'));
  }).join('\n');
}

// Longest first, so `<->` isn't read as `<-` and `>`.
const OPERATORS = [
  ['<->', '\u2194'], ['->', '\u2192'], ['<-', '\u2190'], ['>=', '\u2265'], ['<=', '\u2264'],
  ['!=', '\u2260'], ['~=', '\u2248'], ['>>', '\u226B'], ['<<', '\u226A'], ['+-', '\u00B1'],
  ['.:', '\u2234'], ['*', '\u00D7'], ['>', '>'], ['<', '<'], ['=', '='], ['+', '+'],
];
const OPERATOR = new RegExp(
  `\\s*(${OPERATORS.map(([op]) => op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*`,
  'g',
);
const SYMBOL = new Map(OPERATORS);

/**
 * The inside of `math:[…]`: operators become their symbols, spaced as a
 * relation is, with a no-break space before so a line never starts with one.
 * A `-` becomes a minus unless it joins two words, and `inf` becomes ∞.
 */
export function math(expr) {
  return expr
    .replace(OPERATOR, (m, op) => `\u00A0${SYMBOL.get(op)} `)
    .replace(/(?<!\w)-|-(?!\w)/g, '\u2212')
    .replace(/\binf\b/g, '\u221E')
    .trim();
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

export function searchLink(q, label) {
  const text = label.trim();
  const terms = q
    ? q.split('+').map((t) => { try { return decodeURIComponent(t); } catch { return t; } })
    : text.split(/\s+/);
  const words = terms.filter(Boolean);
  if (!words.length) return null;
  return { href: GOOGLE + words.map(encodeURIComponent).join('+'), label: text || words.join(' ') };
}

export function scriptureLink(p, label) {
  const where = p.replace(/^\/+|\/+$/g, '');
  const text = label.trim();
  if (where) return { href: `${BLB}/${DEFAULT_VERSION}/${where}`, label: text || where };
  const [, ref, version = DEFAULT_VERSION] = WITH_VERSION.exec(text) ?? [];
  const r = ref && REFERENCE.exec(ref.trim());
  if (!r) return null;
  const book = r[1].replace(/[\s.]+/g, '').toLowerCase();
  let href = `${BLB}/${version.toLowerCase()}/${book}/${r[2]}`;
  if (r[3]) href += '/' + r[3].replace(/\s+/g, '').replace(/\u2013/g, '-');
  return { href, label: text };
}

const SIZED = new RegExp(`(<img [^>]*?) title="${SIZE_OPEN}(\\d*)x(\\d*)${SIZE_CLOSE}([^"]*)"`, 'g');

/**
 * The size `expand` left in an image's title becomes its style, and the
 * title goes back to what was written, or away if there wasn't one. A style
 * rather than width and height attributes, which `height: auto` would beat.
 */
export function sizes(html) {
  return html.replace(SIZED, (m, img, w, h, title) => {
    const style = [w && `width: ${w}px`, h && `height: ${h}px`].filter(Boolean).join('; ');
    return `${img}${title ? ` title="${title}"` : ''} style="${style}"`;
  });
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

const ALERTS = {
  note: { icon: '📝', label: 'Note' },
  tip: { icon: '💡', label: 'Tip' },
  important: { icon: '❗', label: 'Important' },
  warning: { icon: '⚠️', label: 'Warning' },
  caution: { icon: '🛑', label: 'Caution' },
};
const ALERT = /<blockquote>\n<p((?: [^>]*)?)>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:<\/p>\n|\n)/gi;

/**
 * GitHub's alerts: a blockquote opening with `[!NOTE]`, `[!TIP]`,
 * `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]` becomes a boxed callout with
 * that emoji at its head. Elsewhere it reads as an ordinary blockquote.
 */
export function alerts(html) {
  return html.replace(ALERT, (m, attrs, kind) => {
    const { icon, label } = ALERTS[kind.toLowerCase()];
    const head = `<p class="alert-title"><span aria-hidden="true">${icon}</span> ${label}</p>\n`;
    // A `[!NOTE]` alone in its paragraph closed that paragraph; one followed
    // by text on the next line did not, so open a new one for the text,
    // keeping the paragraph's attributes (a `:::` block's style).
    return `<blockquote class="alert alert-${kind.toLowerCase()}">\n${head}${m.endsWith('</p>\n') ? '' : `<p${attrs}>`}`;
  });
}

const QUOTE_BY = new RegExp(`<p((?: [^>]*)?)>${BYLINE}|\\n${BYLINE}`, 'g');

/**
 * A blockquote whose last line opened with `--` gets that line as its
 * attribution, in a paragraph of its own, with the attributes of the
 * paragraph it was in (a `:::` block's style).
 */
export function quotes(html) {
  return html
    .replace(QUOTE_BY, (m, attrs, at, all) => {
      // Split off from its paragraph, it takes that paragraph's attributes.
      const own = attrs ?? /<p((?: [^>]*)?)>[^<]*(?:<(?!\/?p[ >])[^<]*)*$/.exec(all.slice(0, at))?.[1] ?? '';
      const p = / class="/.test(own)
        ? `<p${own.replace(/ class="([^"]*)"/, ' class="$1 quote-by"')}>`
        : `<p class="quote-by"${own}>`;
      return attrs === undefined ? `</p>\n${p}` : p;
    })
    .replaceAll(BYLINE, '-- ');
}

const SEARCH_LINK = /<a href="https:\/\/www\.google\.com\/search\?/g;

export function searches(html) {
  return html.replace(SEARCH_LINK, (m) => m.replace('<a ', '<a class="search" '));
}

/**
 * `math:[…]` markers become spans; one alone on its line takes its
 * paragraph with it, centered like a displayed equation.
 */
export function maths(html) {
  return html
    .replace(new RegExp(`<p((?: [^>]*)?)>${MATH_DISPLAY}`, 'g'), (m, attrs) => (/ class="/.test(attrs)
      ? `<p${attrs.replace(/ class="([^"]*)"/, ' class="$1 math-display"')}><span class="math">`
      : `<p class="math-display"${attrs}><span class="math">`))
    .replace(new RegExp(`[${MATH_INLINE}${MATH_DISPLAY}]`, 'g'), '<span class="math">')
    .replaceAll(MATH_CLOSE, '</span>');
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

blockquote.alert {
  color: inherit;
  border: 0.75px solid var(--gm-rule);
  border-left-width: 3px;
  border-radius: 4px;
  padding: 0.55rem 0.85rem;
  margin: 0.8rem 0;
  break-inside: avoid;
}
blockquote.alert > p { margin: 0.3rem 0; }
.alert .alert-title {
  font-family: var(--gm-sans);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-top: 0;
}
.alert-note { border-color: #9db4d6; background: #f4f7fb; }
.alert-tip { border-color: #9cc9a6; background: #f3f9f4; }
.alert-important { border-color: #b8a3d9; background: #f7f4fb; }
.alert-warning { border-color: #dcc07a; background: #fcf8ec; }
.alert-caution { border-color: #dc9a92; background: #fcf1f0; }

blockquote:has(> .quote-by) {
  position: relative;
  color: var(--gm-ink);
  font-style: italic;
  border-left: 0;
  padding-left: 1.7rem;
  margin: 1rem 0;
}
blockquote:has(> .quote-by)::before {
  content: "\\201C";
  position: absolute;
  left: 0;
  top: -0.4rem;
  font-family: var(--gm-serif);
  font-style: normal;
  font-size: 2.6rem;
  line-height: 1;
  color: var(--gm-accent);
}
blockquote > p.quote-by {
  text-align: right;
  font-style: normal;
  font-family: var(--gm-sans);
  font-variant: small-caps;
  letter-spacing: 0.04em;
  font-size: 0.88em;
  color: var(--gm-ink-soft);
  margin-top: 0.35rem;
}
p.quote-by::before { content: "\\2014\\2009"; }

a.search {
  color: inherit;
  text-decoration: underline dotted var(--gm-accent);
  text-underline-offset: 0.2em;
}
a.search::after {
  content: "\\2315";
  display: inline-block;
  margin-left: 0.15em;
  color: var(--gm-accent);
  font-size: 1.1em;
  line-height: 1;
}


table { margin: 0.8rem 0; }
th {
  font-family: var(--gm-sans);
  font-size: 0.88em;
  font-weight: 600;
  background: #f5f3ef;
}
tbody tr:nth-child(even) td { background: #faf9f7; }

.math { font-family: var(--gm-serif); font-style: normal; }
p.math-display { text-align: center; font-size: 1.15em; margin: 0.9rem 0; }
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
