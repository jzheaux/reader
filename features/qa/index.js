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
 * A retro's cards are exchanges too: `Good:`, `Bad:` and `Try:` each start
 * one, labelled G, B and T, and are never continued -- the next is another
 * card. `+1` under a card or a question, named or not and with a comment
 * after a colon or not, is a vote for it: an item of its own, counted on
 * the card.
 *
 *   Bad (Josh): We were surprised by the deadline
 *   +1 (Rob)
 *   A (Rob): Plan them against the calendar.
 *
 * `Bad [x] (Josh):` is a card whose discussion is done: it and what's said
 * under it are faded. On a `Try`, the `[x]` is a box ticked instead: it's
 * been tried, as a recipe's log says of a change to make next time. A
 * click on a card's label writes or takes away the `[x]` (preview.js);
 * `[ ]` is a card not yet done, as no box is.
 *
 * Before anything else reads the source -- the asides included, so
 * that an aside ends where an exchange's line begins -- each such line
 * becomes a `+` list item (so it never joins a `-` or `*` list above it), and
 * one that carries on the item before it is indented into that item. Who
 * spoke is kept, by line, in `env.qa`; once the text is parsed, the items on
 * those lines are labelled, finding their lines through the asides feature's
 * `env.sourceLines`.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeExtract, keepWritten, addClass, escapeAttr, fenced } from '../source.js';
import { workable } from '../blank.js';

// A name may hold a link, whose address is in parentheses of its own.
const QA = /^\\?(Q|A|Good|Bad|Try)(?:[ \t]+\[([ xX])\])?(?:[ \t]*\(((?:[^()\n]|\([^()\n]*\))*)\))?:[ \t]+(?=\S)/;
const VOTE = /^\+1(?:[ \t]*\(((?:[^()\n]|\([^()\n]*\))*)\))?(?::[ \t]+(?=\S)|:?[ \t]*$)/;
const LABELS = { Good: 'G', Bad: 'B', Try: 'T', '+1': '+1' };
const CARDS = new Set(['Good', 'Bad', 'Try']);

export function qa(md) {
  keepWritten(md);
  beforeExtract(md, 'qa_lines', lines);
  // Last, after markdown's own rules: a paragraph split off here has no
  // source text of its own for them to check before they'd run.
  md.core.ruler.push('qa_items', items);
  md.renderer.rules.qa_label = (tokens, i, options, env) => {
    const { who, name, votes, toggle } = tokens[i].meta;
    const tally = votes ? `<span class="qa-tally">+${votes}</span>` : '';
    // A toggle, pressed once discussed, named for its card rather than its
    // letter. An exported page has no script to press it with, so there it's
    // only a label. Elsewhere the page can't be worked, as on a slide, it
    // still says whether it's done, but can't be reached or pressed.
    // A Try is ticked off once it's been tried, a checkbox rather than a toggle.
    const tried = who === 'Try';
    const open = workable(env);
    const reach = open ? 'tabindex="0"' : 'aria-disabled="true"';
    const hint = (t) => (open ? ` title="${t}"` : '');
    const state = tried
      ? `role="checkbox" ${reach} aria-label="Try, tried" aria-checked="${toggle?.done}"${hint(toggle?.done ? 'Not tried yet' : 'Mark it tried')}`
      : `role="button" ${reach} aria-label="${who}, discussed" aria-pressed="${toggle?.done}"${hint(toggle?.done ? 'Reopen the discussion' : 'Mark the discussion done')}`;
    const label = toggle && !env.exported
      ? `<span class="qa-label qa-toggle${tried ? ' qa-tried' : ''}" ${state} data-line="${toggle.line}" data-on="${escapeAttr(toggle.on)}" data-off="${escapeAttr(toggle.off)}">`
      : '<span class="qa-label">';
    // A name is markdown like the rest of the line: *emphasis*, quotes.
    return `${label}${LABELS[who] ?? who}</span>${tally}${name ? `<span class="qa-name">${md.renderInline(name)}</span>` : ''}`;
  };
  md.renderer.rules.qa_para = () => '<span class="qa-para"></span>';
}

/**
 * Rewrites `Q:`, `A:`, card and vote lines as list items, noting who spoke
 * on each. A vote keeps its `+1` as the item's text, so the item is never
 * empty (an empty one would join the line before); labelling takes it off.
 */
function lines(state) {
  // An aside is a thought of the reader's own, not part of an exchange.
  if (state.inlineMode || state.env.nested) return;
  const said = new Map();
  const base = state.env.lineBase ?? 0;
  let open = null;
  // The question or card a vote is for.
  let head = null;
  const code = fenced();
  const out = state.src.split('\n').map((line, n) => {
    if (code(line)) {
      open = head = null;
      return line;
    }
    const v = head && VOTE.exec(line);
    if (v) {
      const text = line.slice(v[0].length);
      head.votes++;
      open = { who: '+1' };
      said.set(n, { who: '+1', name: v[1]?.trim() ?? '', bare: !text, head });
      return `+ +1 ${text}`;
    }
    const q = QA.exec(line);
    // Only a card is done, or not.
    if (!q || q[0].startsWith('\\') || (q[2] && !CARDS.has(q[1]))) {
      const rest = q?.[0].startsWith('\\') ? line.slice(1) : line;
      if (/^\S/.test(rest)) open = head = null;
      return rest;
    }
    const [m, who, box] = q;
    const name = q[3]?.trim() ?? '';
    const text = line.slice(m.length);
    if (open && open.who === who && !CARDS.has(who) && (!name || name === open.name)) {
      said.set(n, { more: true });
      return `  ${text}`;
    }
    open = { who, name };
    const item = { who, name, votes: 0, head };
    if (who !== 'A') item.head = head = item;
    if (CARDS.has(who)) {
      const written = state.env.written?.[n] ?? line;
      const at = written.indexOf(who) + who.length;
      const rest = written.slice(at).replace(/^[ \t]+\[[ xX]\]/, '');
      item.done = box === 'x' || box === 'X';
      item.toggle = {
        done: item.done,
        line: base + n,
        on: `${written.slice(0, at)} [x]${rest}`,
        off: box === ' ' ? written : `${written.slice(0, at)}${rest}`,
      };
    }
    said.set(n, item);
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
  if (!state.env.qa || state.env.nested) return;
  // Lines the parser saw -> lines as written, before asides were taken out.
  const source = state.env.sourceLines;
  const said = { get: (n) => state.env.qa.get(source?.[n] ?? n) };
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'list_item_open' && t.markup === '+' && said.get(t.map?.[0])?.who) {
      const { who, name, votes, bare, head, toggle } = said.get(t.map[0]);
      const kind = who === '+1' ? `vote${bare ? ' qa-bare' : ''}` : `${CARDS.has(who) ? 'card qa-' : ''}${who.toLowerCase()}`;
      addClass(t, `qa qa-${kind}${head?.done ? ' qa-done' : ''}`);
      let k = i + 1;
      while (k < tokens.length && tokens[k].type !== 'inline') k++;
      const inline = tokens[k];
      if (who === '+1') {
        const first = inline.children[0];
        first.content = first.content.replace(/^\+1 ?/, '');
      }
      const label = new state.Token('qa_label', '', 0);
      label.meta = { who, name, votes, toggle };
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
  // Drawn into the preview frame, to make a card's label clickable.
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
};
