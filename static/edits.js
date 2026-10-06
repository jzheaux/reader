/**
 * Edits the rendered page asks for: a checkbox ticked, a field filled in, a
 * puzzle played. The page says which lines of the file it was drawn from and
 * what they said, so an edit made against an older render than the text
 * now holds is refused rather than written over the wrong lines.
 *
 *   { from, to, before, after }
 *
 * replaces lines `from` up to (not including) `to`, which must read `before`
 * (an array of lines), with `after` (another). `from === to` inserts.
 */

/**
 * `text` with `edits` made, as the one stretch of it that changes:
 * { start, end, text } to put in place of `text.slice(start, end)`. Null if
 * an edit is malformed, overlaps another, or doesn't match what `text` says.
 */
export function applyEdits(text, edits) {
  if (!Array.isArray(edits) || !edits.length) return null;
  const lines = text.split('\n');
  const sorted = [...edits].sort((a, b) => b.from - a.from);
  let floor = Infinity;
  for (const e of sorted) {
    if (!valid(e, lines.length) || e.to > floor) return null;
    if (e.before.join('\n') !== lines.slice(e.from, e.to).join('\n') || e.before.length !== e.to - e.from) return null;
    floor = e.from;
  }
  for (const e of sorted) lines.splice(e.from, e.to - e.from, ...e.after);
  return change(text, lines.join('\n'));
}

function valid(e, count) {
  const lines = (a) => Array.isArray(a) && a.every((l) => typeof l === 'string' && !l.includes('\n'));
  return e && Number.isInteger(e.from) && Number.isInteger(e.to)
    && e.from >= 0 && e.from <= e.to && e.to <= count
    && lines(e.before) && lines(e.after);
}

/** The smallest stretch of `a` to replace to make `b`. */
function change(a, b) {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let end = a.length;
  let to = b.length;
  while (end > start && to > start && a[end - 1] === b[to - 1]) {
    end--;
    to--;
  }
  return { start, end, text: b.slice(start, to) };
}

/** A block's text as lines: none for empty text, rather than one empty line. */
export const toLines = (s) => (s === '' ? [] : s.split('\n'));
