/**
 * Re-attaching asides to a parsed document.
 *
 * `preprocess` gave each aside an anchor: a line number in the cleaned source.
 * Here we turn that line number into a position in the token stream, in two
 * different ways depending on what we are rendering.
 *
 *   inline   -- the aside goes immediately after the block it followed, inside
 *               whatever list item or blockquote that block lived in.
 *
 *   columns  -- the speaker's flow is cut into chunks, and each aside is
 *               top-aligned with the chunk that begins at its cut. The cut is
 *               placed at the *start* of the last block written before the
 *               aside, so "~ but it doesn't allow me to add my own voice" lines
 *               up with "markdown is fast" -- the thing it reacts to -- rather
 *               than with the top of the list or the item after it.
 *
 * Cutting a nested structure means closing every open container at the cut and
 * reopening it in the next chunk. Reopened lists carry their numbering forward
 * (`start`, and `value` on an item that was mid-flight), and reopened items are
 * marked so the theme can suppress a second bullet.
 */

import Token from 'markdown-it/lib/token.mjs';

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

function lastBlockBefore(tokens, anchor) {
  let found = null;
  for (const t of tokens) {
    if (!t.map || t.nesting < 0) continue;
    if (t.map[0] >= anchor) break;
    // Containers (lists, items, quotes) hold content but are not themselves the
    // thing being said; only leaf blocks anchor an aside. `inline` is the
    // payload of a block that already counted, so it is skipped too.
    if (CONTAINERS.has(t.type) || t.type === 'inline') continue;
    found = t;
  }
  return found;
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
 * Resolve every aside's anchor line to the token index its column cut belongs
 * at. Returns asides annotated with `cut` (token index) and `blockStart`
 * (source line of the block they are commenting on), in document order.
 */
export function resolveAnchors(tokens, asides) {
  return asides.map((a) => {
    const block = lastBlockBefore(tokens, a.anchor);
    if (!block) return { ...a, blockStart: 0, cut: 0, endCut: 0 };
    return {
      ...a,
      blockStart: block.map[0],
      // Open the row at the start of the block being commented on...
      cut: firstTokenAtOrAfter(tokens, block.map[0]),
      // ...and close it at the end of that block, so whatever the speaker said
      // next begins below the aside instead of running alongside it.
      endCut: firstTokenAtOrAfter(tokens, block.map[1]),
    };
  });
}

/**
 * Find the block an aside follows and the index just past that block's close,
 * used by inline rendering to drop the aside back where it was written.
 */
export function resolveInlineInsertions(tokens, asides) {
  return asides.map((a) => {
    const block = lastBlockBefore(tokens, a.anchor);
    if (!block) return { ...a, at: 0 };
    const openIdx = tokens.indexOf(block);
    if (block.nesting === 0) return { ...a, at: openIdx + 1 };
    let depth = 0;
    for (let i = openIdx; i < tokens.length; i++) {
      depth += tokens[i].nesting;
      if (depth === 0 && i > openIdx) return { ...a, at: i + 1 };
    }
    return { ...a, at: tokens.length };
  });
}

/**
 * Cut the token stream into aligned pairs.
 *
 * @returns {Array<{speaker: Token[], asides: Array<{text: string, line: number}>}>}
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
