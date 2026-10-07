/**
 * Text set in a color and a font, by naming the styles in braces after it:
 * `[this is red]{red}`, `[both]{darkgreen times-new-roman}`. A CSS color name
 * sets the color (the first one given wins); any other name is a font, with
 * hyphens for spaces, tried in order before the page's own. For whole
 * paragraphs, lists or tables, fence them with `:::`:
 *
 *   ::: slategray georgia
 *   Everything here is gray and in Georgia,
 *   :::
 *
 * A span is an inline rule. A `:::` block is read line by line before the
 * blocks are parsed: its fence lines read as blank, and each line inside
 * gets a marker naming the styles, after whatever opens its block (`>`, `~`,
 * a bullet, `#`) and after each table pipe, so it lands in the paragraph,
 * heading, list item or cell that line belongs to. Once parsed, the markers
 * come out and that block takes the styles. Blocks nest; the innermost's
 * font leads and its color wins.
 */

import fs from 'node:fs';
import { beforeAsides } from '../source.js';

const DIV = /^[ \t]{0,3}:::(?:[ \t]+([\w-]+(?:[ \t]+[\w-]+)*))?[ \t]*$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const NAMES = /^\{([\w-]+(?:[ \t]+[\w-]+)*)\}/;
const OPEN = '\uE002';
const CLOSE = '\uE003';
const MARK = new RegExp(`${OPEN}([^${CLOSE}]*)${CLOSE}`, 'g');
// What opens a line's block, for the marker to go after.
const PREFIX = /^[ \t]*(?:[>~][ \t]*)*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?(?:#{1,6}[ \t]+)?/;
// Lines a marker would change the meaning of.
const RULE = /^[ \t]*([-*_=])(?:[ \t]*\1)*[ \t]*$/;
const DELIMITER_ROW = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const REFERENCE_DEF = /^[ \t]{0,3}\[[^\]]+\]:/;

export function styles(md) {
  beforeAsides(md, 'style_lines', lines);
  md.inline.ruler.before('link', 'style_span', span);
  // Before other features look at the text: a marker isn't theirs to see.
  md.core.ruler.after('text_join', 'style_blocks', blocks);
  // Last, so a class this adds comes ahead of theirs.
  md.core.ruler.push('style_attrs', (state) => {
    for (const t of state.tokens) if (t.meta?.style) apply(t, t.meta.style);
  });
  md.renderer.rules.style_span_open = (tokens, i, opts, env, self) => self.renderToken(tokens, i, opts);
  md.renderer.rules.style_span_close = (tokens, i, opts, env, self) => self.renderToken(tokens, i, opts);
}

/** Marks each line inside a `:::` block with the styles it's in. */
function lines(state) {
  if (state.inlineMode || state.env.__aside) return;
  const open = [];
  let fence = null;
  state.src = state.src.split('\n').map((line) => {
    const f = FENCE.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      return line;
    }
    if (f) {
      fence = f[1];
      return line;
    }
    const div = DIV.exec(line);
    if (div) {
      // The fence lines themselves read as blank, keeping the line count.
      if (div[1]) open.push(div[1].trim().split(/\s+/));
      else if (open.length) open.pop();
      else return line;
      return '';
    }
    // Innermost first, so its font leads and its color wins.
    return open.length ? mark(line, [...open].reverse().flat().join(' ')) : line;
  }).join('\n');
}

/**
 * Leave a marker naming `names` inside the block this line belongs to, after
 * whatever opens the block, and after each table pipe so every cell is
 * marked. Lines where a marker would change what the block is -- rules,
 * table delimiters, reference definitions, alerts -- are left alone.
 */
function mark(line, names) {
  if (RULE.test(line) || DELIMITER_ROW.test(line) || REFERENCE_DEF.test(line)) return line;
  const lead = PREFIX.exec(line)[0];
  const rest = line.slice(lead.length);
  if (!rest.trim() || rest.startsWith('[!')) return line;
  const marker = `${OPEN}${names}${CLOSE}`;
  const cells = rest.replace(/(?<!\\)\|[ \t]*(?=\S)/g, `$&${marker}`);
  return lead + (rest.startsWith('|') ? cells : marker + cells);
}

/**
 * Takes the markers out of the text, styling the block each was in: its
 * paragraph, heading or cell, or, in a tight list where paragraphs aren't
 * shown, its list item. In code they just go.
 */
function blocks(state) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'code_block' || t.type === 'fence') {
      t.content = t.content.replace(MARK, '');
      continue;
    }
    if (t.type !== 'inline' || !t.children) continue;
    let names = null;
    for (const c of t.children) {
      if (c.type !== 'text' && c.type !== 'code_inline') continue;
      c.content = c.content.replace(MARK, (m, n) => {
        if (c.type === 'text') names ??= n;
        return '';
      });
    }
    const block = names && holder(tokens, i);
    if (block && !block.meta?.style) block.meta = { ...block.meta, style: names };
  }
}

/** The element an inline token's text shows in. */
function holder(tokens, i) {
  const open = tokens[i - 1];
  if (!open) return null;
  if (['heading_open', 'th_open', 'td_open'].includes(open.type)) return open;
  if (open.type !== 'paragraph_open') return null;
  if (!open.hidden) return open;
  for (let k = i - 2; k >= 0; k--) {
    if (tokens[k].type === 'list_item_open' && tokens[k].level < open.level) return tokens[k];
  }
  return null;
}

/** `[text]{names}`: the text, which is markdown, in a span with those styles. */
function span(state, silent) {
  // Asked only to skip past it, while a link's label is being measured: let
  // the brackets count as brackets, so a link can hold a span.
  if (silent) return false;
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x5B /* [ */) return false;
  if (start > 0 && state.src.charCodeAt(start - 1) === 0x21 /* ! */) return false;
  const end = state.md.helpers.parseLinkLabel(state, start, false);
  if (end < 0 || state.src.slice(start + 1, end).includes('\n')) return false;
  const names = NAMES.exec(state.src.slice(end + 1));
  if (!names) return false;
  const open = state.push('style_span_open', 'span', 1);
  apply(open, names[1]);
  const max = state.posMax;
  state.pos = start + 1;
  state.posMax = end;
  state.md.inline.tokenize(state);
  state.posMax = max;
  state.push('style_span_close', 'span', -1);
  state.pos = end + 1 + names[0].length;
  return true;
}

/**
 * Adds `names` to a token's attributes: a CSS color name sets the color (the
 * first one given wins); every other name is a font, tried in order before
 * falling back to the page's own, and marks the element `font` for the
 * stylesheet.
 */
function apply(token, names) {
  let color = null;
  const fonts = [];
  for (const name of names.trim().split(/\s+/)) {
    const key = name.toLowerCase();
    if (COLORS.has(key)) color ??= key;
    else fonts.push(GENERIC.has(key) ? key : `'${name.replace(/-/g, ' ')}'`);
  }
  const css = [color && `color: ${color}`, fonts.length && `--font: ${fonts.join(', ')}`].filter(Boolean).join('; ');
  if (fonts.length) {
    const cls = token.attrGet('class');
    if (cls) token.attrSet('class', `font ${cls}`);
    else token.attrs = [['class', 'font'], ...(token.attrs || [])];
  }
  const style = token.attrGet('style');
  token.attrSet('style', style ? `${style.replace(/;?\s*$/, '; ')}${css}` : css);
}

// Generic families are written as CSS spells them; any other name is a font,
// its hyphens standing in for spaces.
const GENERIC = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'math', 'emoji',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded',
]);

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

export default {
  name: 'styles',
  plugin: styles,
  css: fs.readFileSync(new URL('./styles.css', import.meta.url), 'utf8'),
};
