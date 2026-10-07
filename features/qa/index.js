/**
 * `Q:` and `A:` at the start of a line make an exchange: each its own item
 * in a list, labelled, with the asker's or answerer's name beside the label
 * when given (`Q (audience):`). A second `A:` in a row, unnamed or naming the
 * same person, continues the answer as a new paragraph rather than starting
 * another; likewise `Q:`. Any other line at the margin ends the exchange,
 * and `\A:` keeps a line that starts that way as typed.
 *
 *   Q (audience): Is this a pendulum swing or an integration?
 *   A (Thomas): An integration.
 *
 * Before anything else reads the source -- gutter-md's asides included, so
 * that an aside ends where an exchange's line begins -- each such line
 * becomes a `+` list item (so it never joins a `-` or `*` list above it), and
 * one that carries on the item before it is indented into that item. Who
 * spoke is kept, by line, in `env.qa`; once the text is parsed, the items on
 * those lines are labelled, finding their lines through gutter-md's
 * `env.sourceLines`.
 */

import fs from 'node:fs';

// A name may hold a link, whose address is in parentheses of its own.
const QA = /^\\?([QA])(?:[ \t]*\(((?:[^()\n]|\([^()\n]*\))*)\))?:[ \t]+(?=\S)/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

/**
 * The start of a `Q:` or `A:` line, for other syntax that needs to see past
 * it (a `:::` block's marker goes after it).
 */
export const LEAD = /(?:\\?[QA](?:[ \t]*\((?:[^()\n]|\([^()\n]*\))*\))?:[ \t]+)?/;

export function qa(md) {
  try {
    md.core.ruler.before('aside_extract', 'qa_lines', lines);
  } catch {
    md.core.ruler.after('normalize', 'qa_lines', lines);
  }
  // Last, after markdown's own rules: a paragraph split off here has no
  // source text of its own for them to check before they'd run.
  md.core.ruler.push('qa_items', items);
  md.renderer.rules.qa_label = (tokens, i) => {
    const { who, name } = tokens[i].meta;
    // A name is markdown like the rest of the line: *emphasis*, quotes.
    return `<span class="qa-label">${who}</span>${name ? `<span class="qa-name">${md.renderInline(name)}</span>` : ''}`;
  };
  md.renderer.rules.qa_para = () => '<span class="qa-para"></span>';
}

/** Rewrites `Q:` and `A:` lines as list items, noting who spoke on each. */
function lines(state) {
  // An aside is a thought of the reader's own, not part of an exchange.
  if (state.inlineMode || state.env.__aside) return;
  const said = new Map();
  let open = null;
  let fence = null;
  const out = state.src.split('\n').map((line, n) => {
    const f = FENCE.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      return line;
    }
    if (f) {
      fence = f[1];
      open = null;
      return line;
    }
    const q = QA.exec(line);
    if (!q || q[0].startsWith('\\')) {
      const rest = q ? line.slice(1) : line;
      if (/^\S/.test(rest)) open = null;
      return rest;
    }
    const [m, who] = q;
    const name = q[2]?.trim() ?? '';
    const text = line.slice(m.length);
    if (open && open.who === who && (!name || name === open.name)) {
      said.set(n, { more: true });
      return `  ${text}`;
    }
    open = { who, name };
    said.set(n, { who, name });
    return `+ ${text}`;
  });
  // An escaped `\A:` loses its backslash even when nothing else changed.
  state.src = out.join('\n');
  if (said.size) state.env.qa = said;
}

/**
 * Labels the list items on lines that held a `Q:` or `A:`, and starts a new
 * paragraph where an item carries on from the line before.
 */
function items(state) {
  if (!state.env.qa || state.env.__aside) return;
  // Lines the parser saw -> lines as written, before asides were taken out.
  const source = state.env.sourceLines;
  const said = { get: (n) => state.env.qa.get(source?.[n] ?? n) };
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'list_item_open' && t.markup === '+' && said.get(t.map?.[0])?.who) {
      const { who, name } = said.get(t.map[0]);
      t.attrJoin('class', `qa qa-${who.toLowerCase()}`);
      let k = i + 1;
      while (k < tokens.length && tokens[k].type !== 'inline') k++;
      const inline = tokens[k];
      const label = new state.Token('qa_label', '', 0);
      label.meta = { who, name };
      inline?.children.unshift(label);
    } else if (t.type === 'inline' && t.map) {
      i = carryOn(state, i, said);
    }
  }
}

/**
 * An answer carried on straight after the line before landed in that line's
 * paragraph: split it off into a paragraph of its own, or, in a tight list
 * where paragraphs aren't shown, mark the break. Returns where to go on from.
 */
function carryOn(state, i, said) {
  const tokens = state.tokens;
  const inline = tokens[i];
  const [start, end] = inline.map;
  // The k-th line break in the paragraph comes before its line start + k.
  const breaks = inline.children.flatMap((c, at) => (c.type === 'softbreak' ? [at] : []));
  const cuts = breaks.filter((at, k) => said.get(start + k + 1)?.more && start + k + 1 < end);
  if (!cuts.length) return i;
  const open = tokens[i - 1];
  const close = tokens[i + 1];
  if (open.hidden) {
    for (const at of cuts) inline.children.splice(at, 1, new state.Token('qa_para', '', 0));
    return i;
  }
  const pieces = [];
  let from = 0;
  for (const at of [...cuts, inline.children.length]) {
    const piece = new state.Token('inline', '', 0);
    piece.children = inline.children.slice(from, at);
    piece.content = '';
    piece.level = inline.level;
    pieces.push(piece);
    from = at + 1;
  }
  const copy = (t) => Object.assign(new state.Token(t.type, t.tag, t.nesting), t, { attrs: t.attrs?.map((a) => [...a]) ?? null });
  const run = pieces.flatMap((piece, k) => (k === 0 ? [piece] : [copy(close), copy(open), piece]));
  tokens.splice(i, 1, ...run);
  return i + run.length - 1;
}

export default {
  name: 'qa',
  plugin: qa,
  css: fs.readFileSync(new URL('./qa.css', import.meta.url), 'utf8'),
};
