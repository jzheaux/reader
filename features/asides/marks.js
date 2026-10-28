/**
 * Marks: words circled, underlined (`underline`, `dotted` or `wavy`) or
 * highlighted, as on paper, in a topic's colour, and tied to the aside
 * that comments on them by a line.
 *
 *   -----
 *   topic a: adjectives, circle
 *   topic c: clauses, teal, highlight
 *   -----
 *
 *   the quick brown fox jumped over [the lazy dog]{c}
 *   ~a[quick] nice job getting the q in early
 *
 * An aside names the words it's about in brackets after its aliases, and
 * they're marked where they are: in the line it's written under, or, when
 * they aren't there or it follows a blank, the paragraph before it. `#2`
 * after them is the second time they're there (`~a[the#2]`); braces after
 * the brackets say how to mark them (`~a[quick]{highlight}`), over the
 * topic's own style, or the underline when it has none. Words written as a
 * mark already, in a style's braces (`[the lazy dog]{c}`, see
 * features/styles and features/mark.js), are that mark, so an aside
 * chooses it by its words; several asides can choose the same words.
 *
 * Each mark has an id, `data-mark`, and the aside about it that id and
 * the words it chose, set at its start (its cell, index.js); preview.js draws the
 * line between them. Words not found are set in the aside all the same,
 * with a `?`.
 */

import { lastBlockBefore } from '../rows.js';
import { markSpan } from '../mark.js';
import { ownColor } from '../color.js';
import { escapeHtml, textToken } from '../source.js';

export function marks(md) {
  md.core.ruler.push('marks', (state) => {
    if (state.inlineMode || state.env.nested) return;
    const shared = state.env.shared ?? state.env;
    const chosen = choose(state, state.env.asides || []);
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue;
      for (const c of block.children) {
        if (c.nesting === 1 && c.meta?.mark && !c.attrGet('data-mark')) c.attrSet('data-mark', `mk-${shared.marks = (shared.marks ?? 0) + 1}`);
      }
    }
    for (const { aside, span, color } of chosen) {
      aside.mark = span
        ? { id: span.attrGet('data-mark'), text: aside.select.text, color: color ?? span.meta.mark.color }
        : { text: aside.select.text, lost: true };
    }
  });
}

/**
 * Finds the words each aside chooses, marking them where they aren't yet:
 * `[{ aside, span, color }]`, with `span` the mark's opening token, or null
 * when the words aren't there.
 */
function choose(state, asides) {
  const tokens = state.tokens;
  const out = [];
  // Words to mark, by the text token they're in: [{ start, end, mark, span }].
  const cuts = new Map();
  for (const aside of asides) {
    if (!aside.select) continue;
    const topic = aside.by?.topics[0];
    const color = topic?.color ?? aside.by?.who?.color ?? null;
    const found = { aside, span: null, color };
    out.push(found);
    const block = lastBlockBefore(tokens, aside.anchor, { into: true });
    const inline = block && tokens[tokens.indexOf(block) + 1];
    if (inline?.type !== 'inline' || !inline.children) continue;

    const { text, nth } = aside.select;
    const all = occurrences(inline.children, text);
    const line = aside.within ? aside.anchor - 1 - inline.map[0] : null;
    const here = all.filter((o) => o.line === line);
    const o = (here.length ? here : all)[nth - 1];
    if (!o) continue;
    if (o.span) {
      found.span = o.span;
      continue;
    }
    const list = cuts.get(o.child) ?? [];
    let cut = list.find((c) => c.start === o.start && c.end === o.end);
    if (!cut) {
      // Words that cross another's, neither holding the other, can't both be marked.
      if (list.some((c) => c.start < o.end && o.start < c.end && !(c.start <= o.start && o.end <= c.end) && !(o.start <= c.start && c.end <= o.end))) continue;
      const span = new state.Token('style_span_open', 'span', 1);
      markSpan(span, { style: aside.select.style ?? topic?.style ?? 'underline', color, topic: topic?.name });
      cut = { start: o.start, end: o.end, span };
      list.push(cut);
      cuts.set(o.child, list);
    }
    found.span = cut.span;
  }

  for (const block of tokens) {
    if (block.type !== 'inline' || !block.children?.some((c) => cuts.has(c))) continue;
    block.children = block.children.flatMap((c) => {
      const list = cuts.get(c);
      if (!list) return [c];
      list.sort((a, b) => a.start - b.start || b.end - a.end);
      return split(state, c.content, 0, c.content.length, list);
    });
  }
  return out;
}

/** `content` from `from` to `to` as text, with each of `cuts` (in order, nested or apart) a mark around its part. */
function split(state, content, from, to, cuts) {
  const out = [];
  let at = from;
  for (let i = 0; i < cuts.length;) {
    const cut = cuts[i];
    let j = i + 1;
    while (j < cuts.length && cuts[j].end <= cut.end) j++;
    if (cut.start > at) out.push(textToken(state, content.slice(at, cut.start)));
    out.push(cut.span, ...split(state, content, cut.start, cut.end, cuts.slice(i + 1, j)), new state.Token('style_span_close', 'span', -1));
    at = cut.end;
    i = j;
  }
  if (at < to) out.push(textToken(state, content.slice(at, to)));
  return out;
}

/**
 * Where `words` are in an inline token's children, in order, each with the
 * line of the paragraph it's on: `{ span, line }` for a mark of just those
 * words, `{ child, start, end, line }` for them in a text token. Only whole
 * words count, and curly quotes are as good as straight.
 */
function occurrences(children, words) {
  const want = straight(words);
  if (!want.trim()) return [];
  const edge = /[\p{L}\p{N}]/u;
  const out = [];
  let line = 0;
  let inside = -1;
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (c.type === 'softbreak' || c.type === 'hardbreak') line++;
    if (i <= inside) continue;
    if (c.nesting === 1 && c.meta?.mark) {
      const close = closeOf(children, i);
      if (straight(children.slice(i + 1, close).map((k) => k.content ?? '').join('')) === want) {
        out.push({ span: c, line });
        inside = close;
      }
      continue;
    }
    if (c.type !== 'text') continue;
    const have = straight(c.content);
    for (let at = have.indexOf(want); at >= 0; at = have.indexOf(want, at + 1)) {
      const end = at + want.length;
      if (edge.test(want[0]) && at > 0 && edge.test(have[at - 1])) continue;
      if (edge.test(want.at(-1)) && end < have.length && edge.test(have[end])) continue;
      out.push({ child: c, start: at, end, line });
    }
  }
  return out;
}

const straight = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

function closeOf(children, i) {
  let depth = 0;
  for (let k = i; k < children.length; k++) {
    depth += children[k].nesting;
    if (!depth) return k;
  }
  return children.length - 1;
}

/** The words an aside chose, to set at its start: its link to the mark when the line can't be seen. */
export function about(mark) {
  if (!mark) return '';
  // in a colour an author wrote, not the family's, the page keeps it readable
  const own = ownColor(mark.color) ? ' gm-own' : '';
  return mark.lost
    ? `<q class="mk-about${own} mk-lost" title="Not found in the line above">${escapeHtml(mark.text)}?</q>`
    : `<q class="mk-about${own}">${escapeHtml(mark.text)}</q>`;
}
