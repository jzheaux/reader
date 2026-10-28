/**
 * Callouts: notes on the lines of a code fence, as AsciiDoc writes them. A
 * line ends in a marker, and the paragraph right after the fence says what
 * each marker is about:
 *
 *   ```java
 *   numbers.stream()
 *     .gather(Gatherers.scan(() -> 0, Integer::sum)) <1>
 *     .forEach(System.out::println); // <2>
 *   ```
 *   <1> `scan()` emits the partial, intermediate results
 *   <2> - one line per running sum
 *
 * A marker is `<N>` at the end of a line, after a space, with a note for N
 * after the fence; anything else (`List<1>`) is code. A comment it's alone
 * in (`// <2>`, `# <2>`, `<!-- <2> -->`) goes with it, so the code copies
 * clean. A note runs from its `<N>` to the next, a `-` after the marker
 * read as part of it.
 *
 * What the code prints goes in an `output` fence right after it, before
 * the notes, and its lines can carry markers too.
 *
 * The fences and notes are drawn as one block (`.code-group`), each line a
 * marker's on saying so (`data-callout`). Each callout is a step of the
 * fence's highlight, after one where none stands out, unless the info
 * string picks out its own (`{1|3}`); a note shows with the first step its
 * lines stand out in (`data-focus`).
 */

import { parseInfo } from './index.js';
import { readNotes, isOutput } from '../fence.js';

const MARKS = /(\S)\s+((?:<\d+>\s*)+)$/;
const ALONE = /(?:^|\s+)(?:\/\/|#|--)$/;
const BLOCK = /(\S)\s+(?:\/\*|<!--)\s*((?:<\d+>\s*)+)(?:\*\/|-->)\s*$/;

/**
 * `code` with the markers of `known` numbers taken off its lines ->
 * `{ code, marks }`, `marks` holding each marked line's numbers by line,
 * counted from 1. A line with a marker not known is left as it is.
 */
export function takeMarks(code, known) {
  const marks = new Map();
  const lines = code.split('\n').map((line, k) => {
    const block = BLOCK.exec(line);
    const m = block || MARKS.exec(line);
    if (!m) return line;
    const ns = m[2].match(/\d+/g).map(Number);
    if (!ns.every((n) => known.has(n))) return line;
    marks.set(k + 1, ns);
    const kept = line.slice(0, m.index + 1);
    return block ? kept : kept.replace(ALONE, '');
  });
  return { code: lines.join('\n'), marks };
}

// Output this many lines or more is cut short, with a way to show the rest.
const LONG = 12;

/**
 * A core rule: a code fence, the `output` fence right after it, and the
 * notes on their lines after those, become one block. Each callout is a
 * step after one where none stands out, unless the code picks out its own
 * lines; the output shows with the first step its lines stand out in, or,
 * with none, as a step of its own, after the rest.
 *
 * A `::: tabs` block of versions of the code takes them as one fence
 * does, after its `:::`: the output and the notes are every version's.
 */
export function callouts(state) {
  const tokens = state.tokens;
  for (const t of tokens) {
    if (!isOutput(t)) continue;
    t.attrJoin('class', 'output');
    t.meta = { ...t.meta, long: t.content.replace(/\n$/, '').split('\n').length > LONG };
  }
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].type !== 'tabs_close') continue;
    const from = tokens.findLastIndex((t, k) => k < i && t.type === 'tabs_open' && t.level === tokens[i].level);
    const fences = tokens.slice(from, i).filter((t) => t.type === 'fence' && !isOutput(t));
    if (fences.length) group(state, from, i, fences);
  }
  for (let i = tokens.length - 1; i >= 0; i--) {
    const fence = tokens[i];
    if (fence.type !== 'fence' || isOutput(fence) || fence.meta?.callouts) continue;
    group(state, i, i, [fence]);
  }
}

/**
 * The code from token `from` to `to` (a fence, or a block of them), with
 * the output and notes after it, as one block, if it has either.
 */
function group(state, from, to, fences) {
  const tokens = state.tokens;
  const first = tokens[from];
  let k = to + 1;
  const output = isOutput(tokens[k]) && tokens[k].level === first.level ? tokens[k++] : null;
  const open = tokens[k]?.type === 'paragraph_open' && tokens[k].level === first.level ? tokens[k] : null;
  let notes = open ? readNotes(tokens[k + 1].content) : [];
  const known = new Set(notes.map((note) => note.n));
  const codes = fences.map((fence) => takeMarks(fence.content, known));
  const out = output ? takeMarks(output.content, known) : { marks: new Map() };
  if (!codes.some((code) => code.marks.size) && !out.marks.size) notes = [];
  if (!output && !notes.length) return;
  if (notes.length) {
    fences.forEach((fence, j) => { fence.content = codes[j].code; });
    if (output) output.content = out.code;
  }

  const linesOf = (marks, n) => [...marks].filter(([, ns]) => ns.includes(n)).map(([line]) => line);
  const marked = (n) => codes.some((code) => linesOf(code.marks, n).length) || linesOf(out.marks, n).length;
  const order = [...new Set(notes.map((note) => note.n))].filter(marked);
  // Lines a fence picks out itself (`{1|3}`) are its steps, when it's the only one.
  const picked = fences.length > 1 ? [] : parseInfo(first.info ? state.md.utils.unescapeAll(first.info) : '').groups;
  const stepsOf = picked.length
    ? (n) => picked.flatMap((g, j) => (linesOf(codes[0].marks, n).some((line) => g.has(line)) ? [j + 1] : []))
    : (n) => (order.includes(n) ? [order.indexOf(n) + 2] : []);
  let steps = picked.length || (order.length ? order.length + 1 : 1);
  const focus = (marks) => new Map([...marks].map(([line, ns]) => [line, [...new Set(ns.flatMap(stepsOf))].sort((a, b) => a - b)]));

  fences.forEach((fence, j) => {
    fence.meta = { ...fence.meta, callouts: codes[j].marks };
    if (!picked.length && order.length) fence.meta.focus = focus(codes[j].marks);
  });
  if (output) {
    const lines = focus(out.marks);
    const at = Math.min(...[...lines.values()].flat());
    const start = Number.isFinite(at) ? at : ++steps;
    output.meta.callouts = out.marks;
    if (out.marks.size) output.meta.focus = lines;
    if (steps > 1) output.attrSet('data-focus', String(start));
  }
  for (const fence of fences) fence.meta.steps = steps;

  const Token = state.Token;
  const make = (type, tag, nesting, attrs = []) => {
    const t = new Token(type, tag, nesting);
    t.block = true;
    t.level = first.level;
    t.attrs = attrs;
    return t;
  };
  const end = notes.length ? k + 2 : k - 1;
  const wrap = make('code_group_open', 'div', 1, [['class', 'code-group']]);
  wrap.map = [first.map[0], (notes.length ? open : output).map[1]];
  wrap.meta = { whole: true };
  const list = !notes.length ? [] : [make('callout_notes_open', 'ol', 1, [['class', 'callout-notes']]), ...notes.flatMap((note) => {
    const li = make('callout_note_open', 'li', 1, [['data-callout', String(note.n)]]);
    const at = stepsOf(note.n);
    if (at.length) li.attrPush(['data-focus', at.join(' ')]);
    const inline = make('inline', '', 0);
    inline.content = note.text;
    inline.children = [];
    return [li, inline, make('callout_note_close', 'li', -1)];
  }), make('callout_notes_close', 'ol', -1)];
  if (list.length) list[0].map = open.map;
  tokens.splice(from, end - from + 1, wrap, ...tokens.slice(from, to + 1), ...(output ? [output] : []), ...list, make('code_group_close', 'div', -1));
}

/** Each note opens with its number, drawn by the stylesheet so it doesn't copy. */
export function renderNote(tokens, i, opts, env, self) {
  const n = tokens[i].attrGet('data-callout');
  return `<li${self.renderAttrs(tokens[i])}><span class="callout" data-n="${n}"></span><span>`;
}

export const renderNoteClose = () => '</span></li>\n';

/** Hovering a line marks its notes, and a note its lines, for numbers up to `max`. */
export function hoverCss(max = 20) {
  const rules = [];
  for (let n = 1; n <= max; n++) {
    const on = `[data-callout~="${n}"]`;
    rules.push(`.code-group:has(${on}:hover) ${on}`);
  }
  return `${rules.join(',\n')} { background: var(--callout-hover); }\n`;
}
