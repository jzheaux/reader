/**
 * The page's rows: the notes in its margin (`env.margin`, src/columns.js)
 * re-attached to the parsed document. The asides feature writes notes
 * there, and any feature may.
 *
 * Each note has an anchor: a line number in the cleaned source, the line it
 * goes before. Here we turn that line number into a position in the token
 * stream. The speaker's flow is cut into chunks, and each note is
 * top-aligned with the chunk that begins at its cut. The cut is placed at
 * the *start* of the last block written before the note, so the aside "~ but
 * it doesn't allow me to add my own voice" lines up with "markdown is fast"
 * -- the thing it reacts to -- rather than with the top of the list or the
 * item after it.
 *
 * Cutting a nested structure means closing every open container at the cut and
 * reopening it in the next chunk. Reopened lists carry their numbering forward
 * (`start`, and `value` on an item that was mid-flight), and reopened items are
 * marked so the theme can suppress a second bullet.
 */

import MarkdownIt from 'markdown-it';

const { Token } = MarkdownIt;

const CONT_CLASS = 'gm-cont';

function cloneToken(t) {
  const c = new Token(t.type, t.tag, t.nesting);
  c.attrs = t.attrs ? t.attrs.map((a) => a.slice()) : null;
  c.map = t.map ? t.map.slice() : null;
  c.block = t.block;
  c.markup = t.markup;
  c.info = t.info;
  c.meta = t.meta;
  c.hidden = t.hidden;
  c.level = t.level;
  return c;
}

function closeToken(openTok) {
  const c = new Token(openTok.type.replace(/_open$/, '_close'), openTok.tag, -1);
  c.block = openTok.block;
  c.markup = openTok.markup;
  return c;
}

/**
 * The last block-level opening token that begins strictly before `anchor`.
 * Only tokens that carry a source map are candidates, which excludes closing
 * tokens and inline children.
 */
const CONTAINERS = new Set([
  'bullet_list_open',
  'ordered_list_open',
  'list_item_open',
  'blockquote_open',
]);

export function lastBlockBefore(tokens, anchor, { into = false } = {}) {
  let found = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t.map || t.nesting < 0) continue;
    if (t.map[0] >= anchor) break;
    // Containers (lists, items, quotes) hold content but are not themselves the
    // thing being said; only leaf blocks anchor an aside. `inline` is the
    // payload of a block that already counted, so it is skipped too.
    if (CONTAINERS.has(t.type) || t.type === 'inline') continue;
    // A row beside an aside after a quote opens with the quote's words, not
    // its attribution (a block tagged `byline`), which stays in the row with
    // them; the words an aside names can still be in the attribution.
    if (t.meta?.byline && !into) continue;
    found = t;
    // What's laid out as one thing (columns) is one block, however much is
    // in it: an aside is beside all of it, and never cuts it. Looking `into`
    // it finds what in it was written last, as the words an aside names are.
    if (t.meta?.whole && t.nesting === 1 && !into) i = closeOf(tokens, i);
  }
  return found;
}

/** The source line `block` ends on, with the attribution after it, if any. */
function endOf(tokens, block) {
  const i = tokens.indexOf(block);
  const next = tokens.slice(i + 1).find((t) => t.map && t.nesting > 0);
  return next?.meta?.byline ? next.map[1] : block.map[1];
}

/**
 * The attributes a note written at `anchor` carries, as its block is
 * tagged with them (`noteAttrs`), or '' for none: one written in a tab,
 * say, shows with that tab (features/tabs).
 */
export function noteAttrs(tokens, anchor) {
  // One written after a block laid out as one thing is about all of it.
  const after = lastBlockBefore(tokens, anchor);
  if (after?.meta?.whole && anchor >= after.map?.[1]) return '';
  return lastBlockBefore(tokens, anchor, { into: true })?.meta?.noteAttrs ?? '';
}

/** The index of the token that closes the one opened at `i`. */
function closeOf(tokens, i) {
  let depth = 0;
  for (let k = i; k < tokens.length; k++) {
    depth += tokens[k].nesting;
    if (!depth) return k;
  }
  return tokens.length - 1;
}

/** Index of the first token that starts at or after source line `line`. */
function firstTokenAtOrAfter(tokens, line) {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.map && t.nesting >= 0 && t.map[0] >= line) return i;
  }
  return tokens.length;
}

/**
 * Resolve every note's anchor line to the token index its column cut belongs
 * at. Returns the notes annotated with `cut` and `endCut` (the token indexes
 * where the block they are commenting on starts and ends), in document order.
 */
export function resolveAnchors(tokens, asides) {
  return asides.map((a) => {
    const block = lastBlockBefore(tokens, a.anchor);
    if (!block) return { ...a, cut: 0, endCut: 0 };
    return {
      ...a,
      // Open the row at the start of the block being commented on...
      cut: firstTokenAtOrAfter(tokens, block.map[0]),
      // ...and close it at the end of that block, so whatever the speaker said
      // next begins below the aside instead of running alongside it.
      endCut: firstTokenAtOrAfter(tokens, endOf(tokens, block)),
    };
  });
}

/**
 * Cut the token stream into aligned pairs, each passage of the speaker's
 * with the notes beside it, its `asides`.
 *
 * @returns {Array<{speaker: Token[], asides: Array<{anchor: number}>}>}
 */
export function splitPairs(tokens, asides) {
  const resolved = resolveAnchors(tokens, asides);

  // Several asides can resolve to the same cut (two thoughts about one line).
  // They share a cell rather than each opening an empty row. A cut with no
  // asides is a plain row break, which is how an aside's row is closed off at
  // the end of its subject.
  const byCut = new Map();
  const addCut = (idx, aside) => {
    if (idx == null || idx <= 0 || idx > tokens.length) return;
    if (!byCut.has(idx)) byCut.set(idx, []);
    if (aside) byCut.get(idx).push(aside);
  };
  for (const a of resolved) {
    if (!byCut.has(a.cut)) byCut.set(a.cut, []);
    byCut.get(a.cut).push(a);
  }
  for (const a of resolved) if (a.endCut > a.cut) addCut(a.endCut, null);
  const cuts = [...byCut.keys()].sort((x, y) => x - y);

  const pairs = [];
  const stack = []; // { token, count } for each open container
  let chunk = [];
  let pendingAsides = null;
  let nextCut = 0;

  const flush = () => {
    // Close everything still open so the chunk is well-formed HTML on its own.
    const closing = [];
    for (let i = stack.length - 1; i >= 0; i--) closing.push(closeToken(stack[i].token));
    pairs.push({ speaker: chunk.concat(closing), asides: pendingAsides || [] });

    // Reopen the same containers to continue the flow in the next chunk.
    chunk = [];
    for (let i = 0; i < stack.length; i++) {
      const frame = stack[i];
      const t = cloneToken(frame.token);
      t.attrJoin('class', CONT_CLASS);
      const childItemOpen = stack[i + 1] && stack[i + 1].token.type === 'list_item_open';
      if (t.type === 'ordered_list_open') {
        // If we cut in the middle of an item, that item resumes with its own
        // number; otherwise the next fresh item takes the following number.
        t.attrSet('start', String(childItemOpen ? frame.count : frame.count + 1));
      }
      if (t.type === 'list_item_open') {
        const parent = stack[i - 1];
        if (parent && parent.token.type === 'ordered_list_open') {
          t.attrSet('value', String(parent.count));
        }
      }
      chunk.push(t);
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    while (nextCut < cuts.length && cuts[nextCut] === i) {
      const group = byCut.get(cuts[nextCut]);
      flush();
      pendingAsides = group;
      nextCut++;
    }

    const t = tokens[i];
    if (t.nesting === 1) {
      if (t.type === 'list_item_open') {
        const parent = stack[stack.length - 1];
        if (parent) parent.count += 1;
      }
      stack.push({ token: t, count: 0 });
    } else if (t.nesting === -1) {
      stack.pop();
    }
    chunk.push(t);
  }

  // Any asides that resolved past the end of the stream.
  while (nextCut < cuts.length) {
    flush();
    pendingAsides = byCut.get(cuts[nextCut]);
    nextCut++;
  }

  pairs.push({ speaker: chunk, asides: pendingAsides || [] });

  // A cut landing at the very end of a container leaves a chunk of nothing but
  // reopened-then-closed tags, which would print as an empty bullet. Keep only
  // rows that actually carry something: a leaf token with content, or an aside.
  const carries = (p) => p.asides.length || p.speaker.some((t) => t.nesting === 0);
  return pairs.filter(carries);
}
