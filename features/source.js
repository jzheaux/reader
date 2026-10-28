/**
 * Helpers for features that read the source as written.
 *
 * Some syntax has to be found in the file before anything else reads it --
 * a checkbox or a field remembers the line it was written on, and the line
 * as written, to be edited later -- even when it ends up in an aside, which
 * is parsed apart from the rest. Such a feature reads each line first
 * (`readLines`, as a core rule before the asides feature's `aside_extract`), keeps
 * what it found on `env`, and leaves a placeholder in the text: a number
 * between two private-use characters, which markdown passes through
 * untouched. Once the text is parsed, it turns its placeholders into tokens
 * (`splitText`).
 */

import { frontMatter, fenced } from '../static/markdown.js';

export { frontMatter, fenced };

/**
 * Adds `rule` to read the source before the asides come out, or after
 * normalizing it when the asides feature isn't in use.
 */
export function beforeAsides(md, name, rule) {
  try {
    md.core.ruler.before('aside_extract', name, rule);
  } catch {
    md.core.ruler.after('normalize', name, rule);
  }
}

/**
 * Keeps the source's lines as written in `env.written`, ahead of every
 * feature that reads the lines and may change them, for a feature that
 * writes one back.
 */
export function keepWritten(md) {
  if (md.core.ruler.__find__('written') >= 0) return;
  md.core.ruler.after('normalize', 'written', (state) => {
    if (!state.inlineMode && !state.env.__aside) state.env.written = state.src.split('\n');
  });
}

/**
 * Runs `fn(line, n, lines, i)` over each line of the source outside fenced
 * code, and puts back what it returns; `lines` are the source's lines as
 * they were, `i` this one's index among them. Skipped for an aside's own parse (its lines
 * were read with the rest) and for inline rendering. The line numbers count
 * from `env.lineBase`, the line of the file the text starts on.
 */
export function readLines(state, fn) {
  if (state.inlineMode || state.env.__aside) return;
  const base = state.env.lineBase ?? 0;
  const code = fenced();
  const lines = state.src.split('\n');
  state.src = lines.map((line, n) => (code(line) ? line : fn(line, base + n, lines, n))).join('\n');
}

/**
 * The private-use characters each feature marks the text with, in one
 * table so no two pick the same: a placeholder's two, or a marker's one.
 */
export const MARKS = {
  tasks: ['\uE000', '\uE001'],
  styles: ['\uE002', '\uE003'],
  attributions: ['\uE007'],
  sizes: ['\uE00E', '\uE00F'],
  fields: ['\uE010', '\uE012'],
  date: ['\uE013', '\uE014'],
  // A layout block's start, a divider between its parts, and its end (layout.js).
  layout: ['\uE021', '\uE022', '\uE023'],
  definitions: ['\uE030', '\uE031'],
};

/**
 * The tags a feature may leave on a token's `meta` for the others to read,
 * named for what they mean rather than for the feature that set them:
 *
 * - `notExported`: draw nothing for the token on an exported page, because
 *   another feature already shows there what it says, and nothing on that
 *   page could change it (a step's box, whose badge says whether it's done).
 */

/** `s` with any placeholders taken out, for the words alone. */
export const unplaced = (s) => s.replace(/[\uE000-\uF8FF]\d*[\uE000-\uF8FF]?/g, '');

/** The placeholder for item `k`, between `open` and `close`. */
export const placeholder = (open, close, k) => `${open}${k}${close}`;

/**
 * Splits each text child of each inline token at the placeholders `pattern`
 * finds (a global regex whose first group is the number), putting
 * `make(k, state)` in their place: a token, or null to leave the text.
 */
export function splitText(state, pattern, make) {
  for (const block of state.tokens) {
    if (block.type !== 'inline' || !block.children) continue;
    block.children = block.children.flatMap((child) => (child.type === 'text' ? split(state, child, pattern, (m) => make(Number(m[1]), state)) : [child]));
  }
}

/**
 * `child`'s text split at each match of `pattern` (a global regex),
 * `make(m)` in its place: a token, or null to leave the match as text.
 * The child itself, alone, if nothing was made.
 */
export function split(state, child, pattern, make) {
  const out = [];
  let last = 0;
  // matchAll starts from the pattern's lastIndex.
  pattern.lastIndex = 0;
  for (const m of child.content.matchAll(pattern)) {
    const made = make(m);
    if (!made) continue;
    if (m.index > last) out.push(textToken(state, child.content.slice(last, m.index)));
    out.push(made);
    last = m.index + m[0].length;
  }
  if (!last) return [child];
  if (last < child.content.length) out.push(textToken(state, child.content.slice(last)));
  return out;
}

/** Calls `fn` on each text child of `inline` outside a link, putting in its place what it returns. */
export function eachText(inline, fn) {
  const out = [];
  let link = 0;
  for (const child of inline.children ?? []) {
    if (child.type === 'link_open') link++;
    if (child.type === 'link_close') link--;
    out.push(...(child.type === 'text' && !link ? fn(child) : [child]));
  }
  inline.children = out;
}

/** `s` with what a regex reads as syntax escaped, to match as written. */
export const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A text token saying `content`. */
export function textToken(state, content) {
  const t = new state.Token('text', '', 0);
  t.content = content;
  return t;
}

/** `&`, `<`, `>` and `"` escaped, for text. */
export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * The same, for an attribute's value. A raw `>` would be valid there, but
 * later passes find tags with `<[^>]*>` and would end the tag at it.
 */
export const escapeAttr = escapeHtml;

/**
 * Adds `name` to a token's classes, after any it has; a token that had none
 * gets its class attribute first, as markdown writes it.
 */
export function addClass(token, name) {
  const had = token.attrGet('class');
  if (had) token.attrSet('class', `${had} ${name}`);
  else token.attrs = [['class', name], ...(token.attrs || [])];
}

/**
 * The sections of a parse, as its headings make them: `list` holds each,
 * `{ level, title, line, end, parent }`, the document's own first (level 0,
 * from its first line); `of[i]` is the section token `i` is in, a heading in
 * its own. `line` is where the section starts in the file and `end` where
 * the next heading at its level or above does (Infinity for none).
 */
export function sections(state) {
  const base = state.env.lineBase ?? 0;
  const lineOf = (t) => base + (state.env.sourceLines?.[t.map[0]] ?? t.map[0]);
  const top = { level: 0, title: '', line: base, end: Infinity, parent: null };
  const list = [top];
  const of = [];
  let at = top;
  state.tokens.forEach((t, i) => {
    if (t.type === 'heading_open' && t.map) {
      const level = Number(t.tag.slice(1));
      const line = lineOf(t);
      for (; at.level >= level; at = at.parent) at.end = line;
      const title = unplaced(state.tokens[i + 1]?.content ?? '').trim();
      at = { level, title, line, end: Infinity, parent: at };
      list.push(at);
    }
    of[i] = at;
  });
  return { list, of };
}

/**
 * The multipliers of a parse's sections (features/count), `of` being
 * `sections(state).of`: `bySection` holds each section's first, in document
 * order, and `nearest(section)` is the nearest section around `section`,
 * itself first, that has one (null for none).
 */
export function multipliers(state, of) {
  const bySection = new Map();
  state.tokens.forEach((block, i) => {
    for (const t of block.children ?? []) if (t.type === 'multiplier' && !bySection.has(of[i])) bySection.set(of[i], t.meta);
  });
  const nearest = (section) => {
    for (let s = section; s; s = s.parent) if (bySection.has(s)) return s;
    return null;
  };
  return { bySection, nearest };
}

/**
 * The ways a word is written, lower-cased: as is, plural and singular
 * (`berry`: `berries`; `beans`: `bean`).
 */
export function wordForms(word) {
  const k = word.toLowerCase();
  const all = new Set([k, `${k}s`, `${k}es`]);
  if (k.endsWith('y')) all.add(`${k.slice(0, -1)}ies`);
  if (k.endsWith('ies')) all.add(`${k.slice(0, -3)}y`);
  if (k.endsWith('es')) all.add(k.slice(0, -2));
  if (k.endsWith('s')) all.add(k.slice(0, -1));
  return [...all];
}

/**
 * A fence's language: the first word of its info string, before any braces
 * (`java` in ` ```java{3} ` and ` ```java {numbers} `), or '' for none.
 */
export function fenceLanguage(info) {
  return info.trim().split(/[\s{]/)[0];
}
