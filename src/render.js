/**
 * Markdown (with `~` asides) -> { css, body } for the preview pane.
 *
 * gutter-md renders a standalone page; the preview iframe is loaded once and
 * has its style and body swapped on every keystroke, so this cuts that page
 * back into its two halves.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, toHtml } from 'gutter-md';
import EMOJI from 'markdown-it-emoji/lib/data/full.mjs';
import { ldsLink } from './lds.js';

/**
 * `line` is the line of the file `src` starts on, when it is only part of
 * one (a slide), so whatever is written back by line number finds its line.
 */
export function render(src, { file, puzzleBase = 0, read, line = 0 } = {}) {
  const text = expand(src || '', { line });
  const { meta, asides } = parse(text);
  // The line of the file, as written, that a marker's line number names.
  const lines = (src || '').split('\n');
  const lineAt = (n) => lines[n - line] ?? '';

  // Column headings ("Speaker" / "Listener") only help when the document
  // names its voices; a journal entry doesn't need them.
  const headings = Boolean(asides.length && (meta.speaker || meta.listener));
  const title = meta.title || (file ? path.basename(file, path.extname(file)) : 'Untitled');

  const html = toHtml(text, { layout: 'columns', headings, title });
  const body = emojify(styles(maths(exchanges(searches(quotes(fields(tasks(alerts(figures(sizes(between(html, '<body>', '</body>').trim()))), lineAt), lineAt)))))));
  const played = puzzles(body, puzzleBase, fences(text, { file, read, line }));
  return {
    css: `${between(html, '<style>', '</style>').trim()}\n${CSS}`,
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
const TASK = /^([ \t]*(?:[>~][ \t]*)*(?:[-*+]|\d{1,9}[.)])[ \t]+)(?:\[([ xX])\]|\(([ xX])\))(?=[ \t]|$)/;

// A task's box is carried through markdown as a private-use marker holding
// its line number and kind (`t` for a checkbox, `r` for a radio button), so
// the rendered box knows which line to toggle.
const MARK_OPEN = '\uE000';
const MARK_CLOSE = '\uE001';

// Styles ride through markdown the same way: a `:::` block leaves a marker
// on each of its lines naming the styles, a `[text]{styles}` span wraps its
// text in open and close markers, and a quote's `--` becomes a marker at the
// head of its attribution.
const BLOCK_OPEN = '\uE002';
const BLOCK_CLOSE = '\uE003';
const SPAN_OPEN = '\uE004';
const SPAN_TEXT = '\uE005';
const SPAN_CLOSE = '\uE006';
const BYLINE = '\uE007';

// A `Q:` or `A:` line becomes an item in a list of its own (`+`, so it never
// joins a `-` or `*` list above it), headed by a marker naming who spoke. One
// that carries on the item before it becomes a paragraph within that item.
const QA_OPEN = '\uE008';
const QA_CLOSE = '\uE009';
const QA_MORE = '\uE00D';

// An image's size rides through markdown at the head of its title, between
// these markers, for `sizes` to take back out.
const SIZE_OPEN = '\uE00E';
const SIZE_CLOSE = '\uE00F';
const IMG_SIZE = /!\[([^\]\n]*)\]\([ \t]*(<[^>\n]*>|[^\s()]+)(?:[ \t]+("[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?[ \t]+=(\d*)x(\d*)[ \t]*\)/g;
// An `@ Label: value` line rides through markdown as one marker holding its
// line number, label and value, the last two encoded so markdown leaves them
// exactly as typed.
const FIELD_OPEN = '\uE010';
const FIELD_SEP = '\uE011';
const FIELD_CLOSE = '\uE012';
const FIELD = /^@[ \t]+([^:\n]*?[^:\s])[ \t]*(:+)[ \t]*(.*?)[ \t]*$/;
const QA = /^\\?([QA])(?:[ \t]*\(([^()\n]*)\))?:[ \t]+(?=\S)/;

// `math:[…]` is carried as open and close markers, the open one saying
// whether it stood alone on its line.
const MATH_INLINE = '\uE00A';
const MATH_DISPLAY = '\uE00B';
const MATH_CLOSE = '\uE00C';
const MATH = /(?<![\w\\])math:\[([^\]\n]*)\]/g;
const MATH_ALONE = /^[ \t]*math:\[[^\]\n]*\][ \t]*$/;

const DIV = /^[ \t]{0,3}:::(?:[ \t]+([\w-]+(?:[ \t]+[\w-]+)*))?[ \t]*$/;
const SPAN = /(?<![\\!])\[((?:[^[\]\n]|\[[^[\]\n]*\])*)\]\{([\w-]+(?:[ \t]+[\w-]+)*)\}/g;
const ATTRIBUTION = /^([ \t]*(?:~[ \t]*)*(?:>[ \t]*)+)(?:--|\u2014)[ \t]+(?=\S)/;
const QUOTED = /^[ \t]*(?:~[ \t]*)*>/;
const PREFIX = new RegExp(
  '^[ \\t]*(?:[>~][ \\t]*)*(?:(?:[-*+]|\\d{1,9}[.)])[ \\t]+)?'
  + `(?:${QA_OPEN}[^${QA_CLOSE}]*${QA_CLOSE})?${QA_MORE}?`
  + `(?:${MARK_OPEN}\\d+:[tr][ xX]${MARK_CLOSE}[ \\t]?)?(?:#{1,6}[ \\t]+)?${BYLINE}?`,
);
const RULE = /^[ \t]*([-*_=])(?:[ \t]*\1)*[ \t]*$/;
const DELIMITER_ROW = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const REFERENCE_DEF = /^[ \t]{0,3}\[[^\]]+\]:/;

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
 * - `Q:` and `A:` (or `Q (name):`) at the start of a line -> an exchange. A
 *   second `A:` in a row, unnamed or naming the same person, continues the
 *   answer rather than starting another; likewise `Q:`.
 * - `[text]{red times-new-roman}` -> styled text, and `::: red` ... `:::` the
 *   same for every block in between.
 * - `> -- Author` closing a blockquote -> that quote's attribution.
 * - `@ My Name: Josh` at the margin -> a form field, labelled "My Name"
 *   and filled with "Josh", that `fields` makes fillable from the preview.
 *   Each colon is a line of blank: `@ Notes:::` is three lines tall.
 * - `- [ ]` and `- [x]` at the start of a list item -> a marker that `tasks`
 *   turns into a checkbox; `- ( )` and `- (x)`, a radio button, one choice
 *   to a list.
 * - `![alt](img.png =100x200)`, `=100x` or `=x200` -> an image of that size
 *   in pixels, a missing side scaled to keep its proportions. `sizes` sets it.
 *
 * Like shortcodes, the source keeps what was typed, and code is left alone.
 * Line numbers are preserved; those the markers carry count from `line`.
 */
export function expand(src, { line: first = 0 } = {}) {
  let fence = null;
  const blocks = [];
  let qa = null;
  const lines = src.split('\n');
  return lines.map((line, n) => {
    const f = FENCE.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      return line;
    }
    if (f) {
      fence = f[1];
      qa = null;
      return line;
    }
    const div = DIV.exec(line);
    if (div) {
      // The fence lines themselves read as blank, keeping the line count.
      if (div[1]) blocks.push(div[1].trim().split(/\s+/));
      else if (blocks.length) blocks.pop();
      else return line;
      return '';
    }
    const at = first + n;
    line = line.replace(TASK, (m, lead, box, radio) => `${lead}${MARK_OPEN}${at}:${box ? `t${box}` : `r${radio}`}${MARK_CLOSE}`);
    line = line.replace(FIELD, (m, label, colons, value) => `${FIELD_OPEN}${at}${FIELD_SEP}${colons.length}${FIELD_SEP}${seal(label)}${FIELD_SEP}${seal(value)}${FIELD_CLOSE}`);
    [line, qa] = exchange(line, qa);
    const alone = MATH_ALONE.test(line);
    const next = lines[n + 1];
    if (next === undefined || !QUOTED.test(next)) line = line.replace(ATTRIBUTION, `$1${BYLINE}`);
    // Innermost first, so its font leads and its color wins.
    if (blocks.length) line = markBlock(line, [...blocks].reverse().flat().join(' '));
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
      .replace(SPAN, (m, inner, names) => `${SPAN_OPEN}${names}${SPAN_TEXT}${inner}${SPAN_CLOSE}`)
      .replace(/(?<!\\)<->/g, '\u2194')
      .replace(/(?<![-<\\])->/g, '\u2192')
      .replace(/(?<!\\)<-(?![-<>])/g, '\u2190'));
  }).join('\n');
}

/**
 * A `Q:` or `A:` line -> a list item, or, when it carries on the item open
 * before it, a paragraph indented into that item. Any other line that starts
 * at the margin closes the exchange.
 */
function exchange(line, open) {
  const q = QA.exec(line);
  if (!q || q[0].startsWith('\\')) {
    const rest = q ? line.slice(1) : line;
    return [rest, /^\S/.test(rest) ? null : open];
  }
  const [m, who] = q;
  const name = q[2]?.trim() ?? '';
  const text = line.slice(m.length);
  if (open && open.who === who && (!name || name === open.name)) return [`  ${QA_MORE}${text}`, open];
  return [`+ ${QA_OPEN}${who}${name}${QA_CLOSE}${text}`, { who, name }];
}

/**
 * Leave a marker naming `names` inside the block this line belongs to, after
 * whatever opens the block (`>`, `~`, a list bullet, `#`), and after each
 * table pipe so every cell is marked. Lines where a marker would change what
 * the block is -- rules, table delimiters, reference definitions, alerts --
 * are left alone.
 */
function markBlock(line, names) {
  if (RULE.test(line) || DELIMITER_ROW.test(line) || REFERENCE_DEF.test(line)) return line;
  const lead = PREFIX.exec(line)[0];
  const rest = line.slice(lead.length);
  if (!rest.trim() || rest.startsWith('[!')) return line;
  const mark = `${BLOCK_OPEN}${names}${BLOCK_CLOSE}`;
  const cells = rest.replace(/(?<!\\)\|[ \t]*(?=\S)/g, `$&${mark}`);
  return lead + (rest.startsWith('|') ? cells : mark + cells);
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
const ALERT = /<blockquote>\n<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:<\/p>\n|\n)/gi;

/**
 * GitHub's alerts: a blockquote opening with `[!NOTE]`, `[!TIP]`,
 * `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]` becomes a boxed callout with
 * that emoji at its head. Elsewhere it reads as an ordinary blockquote.
 */
export function alerts(html) {
  return html.replace(ALERT, (m, kind) => {
    const { icon, label } = ALERTS[kind.toLowerCase()];
    const head = `<p class="alert-title"><span aria-hidden="true">${icon}</span> ${label}</p>\n`;
    // A `[!NOTE]` alone in its paragraph closed that paragraph; one followed
    // by text on the next line did not, so open a new one for the text.
    return `<blockquote class="alert alert-${kind.toLowerCase()}">\n${head}${m.endsWith('</p>\n') ? '' : '<p>'}`;
  });
}

const MARKER = new RegExp(`${MARK_OPEN}(\\d+):([tr])([ xX])${MARK_CLOSE}`, 'g');
const TASK_ITEM = `(<li)((?: class="[^"]*")?>\\s*(?:<p>)?)${MARK_OPEN}(\\d+):([tr])([ xX])${MARK_CLOSE}[ \\t]?`;
const TASK_OR_LIST = new RegExp(`${TASK_ITEM}|<(/?)[ou]l\\b`, 'g');

/**
 * Markers left by `expand` at the head of a list item become checkboxes, or
 * radio buttons, that carry their source line, and that line as it reads
 * with the box checked and unchecked; the radio buttons of one list share a
 * name, so only one can be chosen. Anywhere else (say, an indented code
 * block) they go back to the `[ ]` or `( )` that was typed. `lineAt(n)` is
 * line `n` as written.
 */
export function tasks(html, lineAt = () => '') {
  const lists = [];
  let count = 0;
  return html
    .replace(TASK_OR_LIST, (m, open, rest, line, kind, box, close) => {
      if (!open) {
        if (close) lists.pop();
        else lists.push(++count);
        return m;
      }
      const checked = box === ' ' ? '' : ' checked';
      const cls = rest.startsWith(' class="')
        ? rest.replace(' class="', ' class="task ')
        : ` class="task"${rest}`;
      const text = lineAt(Number(line));
      const as = (on) => (checked && on ? text : text.replace(TASK, (t, lead, b) => `${lead}${b ? '[' : '('}${on ? 'x' : ' '}${b ? ']' : ')'}`));
      const lines = ` data-on="${escapeAttr(as(true))}" data-off="${escapeAttr(as(false))}"`;
      const input = kind === 't'
        ? `<input type="checkbox" class="task-box" data-line="${line}"${lines}${checked}>`
        : `<input type="radio" class="choice-box" name="choice-${lists.at(-1)}" data-line="${line}"${lines}${checked}>`;
      return `${open}${cls}${input} `;
    })
    .replace(MARKER, (m, line, kind, box) => (kind === 't' ? `[${box}]` : `(${box})`));
}

// Percent-encoding, down to the punctuation markdown or `expand` might read.
const seal = (s) => encodeURIComponent(s).replace(/[!'()*~_.-]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const FIELD_MARK = new RegExp(`${FIELD_OPEN}(\\d+)${FIELD_SEP}(\\d+)${FIELD_SEP}([^${FIELD_SEP}]*)${FIELD_SEP}([^${FIELD_CLOSE}]*)${FIELD_CLOSE}\\n?`, 'g');

const FIELD_HEAD = /^@[ \t]+[^:\n]*?[^:\s][ \t]*:+/;

/**
 * Markers left by `expand` for `@ Label: value` become form fields, one to a
 * line, carrying their source line and the value as typed so the preview
 * can open the blank for editing and write it back: the line as written,
 * and its head, up to the colons, for a new value to follow. A blank of
 * more than one line says how many, for the stylesheet. `lineAt(n)` is line
 * `n` as written.
 */
export function fields(html, lineAt = () => '') {
  return html.replace(FIELD_MARK, (m, line, lines, label, value) => {
    const v = escape(decodeURIComponent(value));
    const text = lineAt(Number(line));
    const source = ` data-text="${escapeAttr(text)}" data-head="${escapeAttr(FIELD_HEAD.exec(text)?.[0] ?? '')}"`;
    const tall = lines > 1 ? ` data-lines="${lines}" style="--lines: ${lines}"` : '';
    return `<span class="field" data-line="${line}"${source}${tall}><span class="field-label">${escape(decodeURIComponent(label))}</span>`
      + `<span class="field-value" data-value="${v}">${v}</span></span>`;
  });
}

const QUOTE_BY = new RegExp(`(<p>|\\n)${BYLINE}`, 'g');

/**
 * A blockquote whose last line opened with `--` gets that line as its
 * attribution, in a paragraph of its own.
 */
export function quotes(html) {
  return html
    .replace(QUOTE_BY, (m, lead) => (lead === '<p>' ? '<p class="quote-by">' : '</p>\n<p class="quote-by">'))
    .replaceAll(BYLINE, '-- ');
}

const SEARCH_LINK = /<a href="https:\/\/www\.google\.com\/search\?/g;

export function searches(html) {
  return html.replace(SEARCH_LINK, (m) => m.replace('<a ', '<a class="search" '));
}

const QA_MORE_MARK = new RegExp(`(<p>)${QA_MORE}|\\n?${QA_MORE}`, 'g');
const QA_ITEM = new RegExp(`<li>(\\s*(?:<p>)?)${QA_OPEN}([QA])([^${QA_CLOSE}]*)${QA_CLOSE}`, 'g');

/**
 * `Q:` and `A:` items become an exchange: each labelled, the asker's name or
 * the answerer's beside the label when given.
 */
export function exchanges(html) {
  return html
    .replace(QA_ITEM, (m, lead, who, name) => {
      const tag = `<span class="qa-label">${who}</span>${name ? `<span class="qa-name">${name}</span>` : ''}`;
      return `<li class="qa qa-${who.toLowerCase()}">${lead}${tag}`;
    })
    .replace(new RegExp(`${QA_OPEN}([QA])([^${QA_CLOSE}]*)${QA_CLOSE}`, 'g'), (m, who, name) => `${who}${name ? ` (${name})` : ''}: `)
    .replace(QA_MORE_MARK, (m, open, offset, html) => {
      if (open) return open;
      // Typed straight after the line before, it landed in that paragraph;
      // split it off. In a tight list there is no paragraph to split.
      const before = html.slice(0, offset);
      const p = Math.max(before.lastIndexOf('<p>'), before.lastIndexOf('<p '));
      return p > Math.max(before.lastIndexOf('</p>'), before.lastIndexOf('<li'))
        ? '</p>\n<p>'
        : '<span class="qa-para"></span>';
    });
}

/**
 * `math:[…]` markers become spans; one alone on its line takes its
 * paragraph with it, centered like a displayed equation.
 */
export function maths(html) {
  return html
    .replaceAll(`<p>${MATH_DISPLAY}`, `<p class="math-display"><span class="math">`)
    .replace(new RegExp(`[${MATH_INLINE}${MATH_DISPLAY}]`, 'g'), '<span class="math">')
    .replaceAll(MATH_CLOSE, '</span>');
}

const STYLE_BLOCK = new Set(['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th', 'dt', 'dd']);
const BLOCK_MARK = new RegExp(`${BLOCK_OPEN}([^${BLOCK_CLOSE}]*)${BLOCK_CLOSE}`, 'g');
const SPAN_MARK = new RegExp(`${SPAN_OPEN}([^${SPAN_TEXT}]*)${SPAN_TEXT}`, 'g');
const SPAN_TYPED = new RegExp(`${SPAN_OPEN}([^${SPAN_TEXT}]*)${SPAN_TEXT}([^${SPAN_CLOSE}]*)${SPAN_CLOSE}`, 'g');

/**
 * Markers left by `expand` for `[text]{…}` become spans, and those for a
 * `:::` block style the paragraph, heading, list item or cell holding them.
 * In code they go back to what was typed.
 */
export function styles(html) {
  let raw = 0;
  let block = -1;
  const styled = new Set();
  const out = [];
  for (const [, tag, text] of html.matchAll(/(<[^>]*>)|([^<]+)/g)) {
    if (tag) {
      const t = /^<(\/?)([a-z0-9]+)/i.exec(tag);
      const name = t?.[2].toLowerCase();
      if (RAW.has(name)) raw = Math.max(0, raw + (t[1] ? -1 : 1));
      else if (!t?.[1] && STYLE_BLOCK.has(name)) block = out.length;
      out.push(tag);
      continue;
    }
    if (raw) {
      out.push(text.replace(BLOCK_MARK, '').replace(SPAN_TYPED, '[$2]{$1}').replace(/[\uE00A-\uE00D]/g, ''));
      continue;
    }
    out.push(text
      .replace(BLOCK_MARK, (m, names) => {
        if (block >= 0 && !styled.has(block)) {
          styled.add(block);
          out[block] = withStyle(out[block], names);
        }
        return '';
      })
      .replace(SPAN_MARK, (m, names) => withStyle('<span>', names))
      .replaceAll(SPAN_CLOSE, '</span>'));
  }
  return out.join('');
}

// Generic families are written as CSS spells them; any other name is a font,
// its hyphens standing in for spaces.
const GENERIC = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'math', 'emoji',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded',
]);

/**
 * `names` -> the tag with a color and a font added. A CSS color name sets the
 * color (the first one given wins); every other name is a font, tried in
 * order before falling back to the page's own.
 */
function withStyle(tag, names) {
  let color = null;
  const fonts = [];
  for (const name of names.trim().split(/\s+/)) {
    const key = name.toLowerCase();
    if (COLORS.has(key)) color ??= key;
    else fonts.push(GENERIC.has(key) ? key : `'${name.replace(/-/g, ' ')}'`);
  }
  const css = [color && `color: ${color}`, fonts.length && `--font: ${fonts.join(', ')}`].filter(Boolean).join('; ');
  let t = tag;
  if (fonts.length) {
    t = / class="/.test(t) ? t.replace(' class="', ' class="font ') : t.replace(/^<([a-z0-9]+)/i, '<$1 class="font"');
  }
  return / style="/.test(t)
    ? t.replace(/ style="([^"]*)"/, (m, s) => ` style="${s.replace(/;?\s*$/, '; ')}${css}"`)
    : t.replace(/>$/, ` style="${css}">`);
}

const COLORS = new Set(`
  aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown
  burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan
  darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid
  darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet
  deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro
  ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
  lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow
  lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray
  lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine
  mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise
  mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab
  orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru
  pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
  seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan
  teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen
`.trim().split(/\s+/));

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

.font { font-family: var(--font), var(--gm-serif); }
.gm-aside-cell .font { font-family: var(--font), var(--gm-sans); }

table { margin: 0.8rem 0; }
th {
  font-family: var(--gm-sans);
  font-size: 0.88em;
  font-weight: 600;
  background: #f5f3ef;
}
tbody tr:nth-child(even) td { background: #faf9f7; }

ul:has(> li.qa) { list-style: none; padding-left: 0; margin: 0.8rem 0; }
li.qa {
  position: relative;
  padding-left: 1.9rem;
  margin: 0.3rem 0;
  font-family: var(--gm-sans);
  font-size: 0.92em;
}
li.qa-a + li.qa-q { margin-top: 0.9rem; }
.qa-para { display: block; height: 0.5em; }
li.qa-q { font-style: italic; color: var(--gm-aside-ink); }
.qa-label {
  position: absolute;
  left: 0;
  top: 0.15em;
  width: 1.25rem;
  line-height: 1.25rem;
  border-radius: 3px;
  text-align: center;
  font-family: var(--gm-sans);
  font-style: normal;
  font-size: 0.72rem;
  font-weight: 700;
  border: 1px solid var(--gm-accent);
  color: var(--gm-accent);
}
li.qa-a > .qa-label, li.qa-a > p:first-child > .qa-label {
  background: var(--gm-accent);
  color: var(--gm-paper);
}
.qa-name {
  font-family: var(--gm-sans);
  font-style: normal;
  font-variant: small-caps;
  letter-spacing: 0.04em;
  font-size: 0.85em;
  color: var(--gm-ink-soft);
  margin-right: 0.45em;
}

.math { font-family: var(--gm-serif); font-style: normal; }
p.math-display { text-align: center; font-size: 1.15em; margin: 0.9rem 0; }

.field {
  display: flex;
  align-items: flex-start;
  gap: 0.5em;
  margin: 0.3rem 0;
  max-width: 32rem;
  cursor: text;
}
.field[data-lines] { max-width: none; }
/* As tall as a line of the blank, so it sits level with the first. */
.field-label {
  font-family: var(--gm-sans);
  font-size: 0.85em;
  line-height: calc(1.6em / 0.85);
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--gm-ink-soft);
  white-space: nowrap;
}
.field-label::after { content: ":"; }
/* A shaded band for each line, with a sliver of page between them. */
.field-value {
  --gm-field-shade: rgba(127, 127, 127, 0.07);
  flex: 1;
  min-width: 6rem;
  min-height: calc(var(--lines, 1) * 1.6em);
  padding: 0 0.25em;
  line-height: 1.6;
  overflow-wrap: anywhere;
  background: repeating-linear-gradient(to bottom,
    var(--gm-field-shade) 0 calc(1.6em - 3px), transparent 0 1.6em);
  border-radius: 2px;
}
.field:hover .field-value { --gm-field-shade: rgba(127, 127, 127, 0.12); }
.field-value:has(> textarea) {
  --gm-field-shade: color-mix(in srgb, var(--gm-accent) 14%, transparent);
}
.field-value > textarea {
  all: unset;
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-height: calc(var(--lines, 1) * 1.6em);
  font: inherit;
  line-height: inherit;
  color: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  overflow: hidden;
  resize: none;
}

li.task { list-style: none; }
li.task > .task-box, li.task > p > .task-box,
li.task > .choice-box, li.task > p > .choice-box {
  margin: 0 0.4em 0 -1.35rem;
  vertical-align: -0.1em;
  cursor: pointer;
}
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

function between(s, open, close) {
  const start = s.indexOf(open);
  const end = s.lastIndexOf(close);
  if (start < 0 || end < start) return '';
  return s.slice(start + open.length, end);
}
