/**
 * Source-level pass that lifts asides (and front matter) out of a document
 * *before* the markdown block parser runs.
 *
 * This is the heart of the extension. An aside is a marginal thought, so it
 * must not change the shape of the thing it is written beside. If the `~` line
 * were left in place, the block parser would read it as ordinary content and it
 * would terminate the list item it sits inside, split a paragraph, or reset a
 * numbered list. By removing aside lines here, the speaker's outline parses
 * exactly as it would have if you had never annotated it, and each aside keeps
 * an anchor -- the line of the cleaned source it was written after -- so it can
 * be re-attached once the structure is known.
 */

import { readEntry, makeKey, attribute } from './key.js';
import { STYLES } from '../mark.js';
import { OPEN, DIVIDER, CLOSE } from '../layout.js';
import { frontMatter, fenced } from '../source.js';

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;

// A `~` on its own, or followed by whitespace. `~~strike~~` and the `~~~` fence
// are both excluded by requiring the next character not to be another tilde.
// A run of aliases may come between the `~` and the space (see key.js), and
// after them the words in the line above it's about, in brackets, with how
// to mark them in braces (see marks.js): `~v[jumped]{circle}`.
const ASIDE_RE = new RegExp(String.raw`^([ \t]*)~(?!~)([^\s~[]*)(?:\[((?:[^\]\\\n]|\\.)+)\](?:\{(${STYLES.join('|')})\})?)?([ \t]+.*)?$`, 'i');

/**
 * Is `line` an aside, and if so, whose and about what: `{ by, select }`,
 * with `by` null for the writer's own and `select` null when it names no
 * words.
 */
function asideOf(line, key) {
  const m = ASIDE_RE.exec(line);
  if (!m) return null;
  const select = m[3] == null ? null : selection(m[3], m[4]);
  if (!m[2]) return { m, by: null, select };
  const by = attribute(m[2], key);
  return by ? { m, by, select } : null;
}

/** `the#2` -> `{ text: 'the', nth: 2, style }`: the second `the`. */
function selection(written, style) {
  const n = /#(\d+)$/.exec(written);
  const text = (n ? written.slice(0, n.index) : written).replace(/\\(.)/g, '$1');
  return { text, nth: n ? Number(n[1]) : 1, style: style?.toLowerCase() ?? null };
}

// Lines that begin a block the aside should not swallow as a lazy continuation:
// markdown's own, and reader's `:::` styles, `+++` panes, `@` fields and
// `!TERM:` definitions; and a layout's lines, once the styles feature has
// left them as marks of their own (features/layout.js).
const BLOCK_START_RE = new RegExp(String.raw`^[ \t]*(?:[*+-][ \t]|\d+[.)][ \t]|#{1,6}[ \t]|>|${'```'}|~{3,}|-{3,}\s*$|_{3,}\s*$|:{3}|\+{3,}(?:[ \t]|$)|@[ \t]|\\?![ \t]*[^\s[!:()][^:\n]*:(?:[ \t]|$)|[${OPEN}${DIVIDER}${CLOSE}])`);

// An HTML comment on lines of its own. The renderer takes no HTML, so it would
// otherwise show as text; it's dropped instead, asides and all, which makes it
// the place for a note to whoever opens the file, such as how to review it.
const COMMENT_START_RE = /^ {0,3}<!--/;

function expandTabs(line) {
  return line.replace(/\t/g, '    ');
}

function indentOf(line) {
  return expandTabs(line).match(/^ */)[0].length;
}

/**
 * @param {string} src raw document text
 * @param {object} [opts]
 * @param {Map} [opts.key] the aliases to use when `src` has no front matter
 *   declaring its own (a deck's slide, under the deck's)
 * @returns {{meta: object, source: string, asides: Array<{anchor: number, text: string, line: number}>}}
 *   `meta` is the front matter's (static/markdown.js);
 *   `source` is the document with front matter and aside lines removed;
 *   `anchor` is an index into `source`'s lines -- the aside belongs immediately
 *   before that line; `line` is the aside's 0-based line in the original file.
 *   `lines` has, for each line of `source`, the 0-based line of the original
 *   it came from, so positions in `source` can be traced back to the file.
 *   `key` is the aliases declared (see key.js), and an aside written with
 *   them has `by: { who, topics, unknown }`. One naming words in brackets
 *   has `select: { text, nth, style }`, and `within` when it's written
 *   straight under the line they're in.
 */
export function preprocess(src, opts = {}) {
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  // --- front matter -------------------------------------------------------
  // Josh's convention uses `-----`, but `---` works too.
  const matter = frontMatter(lines, { entry: readEntry });
  const meta = matter?.meta ?? {};
  let i = matter?.end ?? 0;
  if (matter) while (i < lines.length && !lines[i].trim()) i++;

  const key = matter?.entries.length ? makeKey(matter.entries) : (opts.key || new Map());

  // --- asides -------------------------------------------------------------
  const out = [];
  const from = [];
  const asides = [];
  const code = fenced();

  while (i < lines.length) {
    const line = lines[i];

    // Never look inside fenced code.
    if (code(line)) {
      out.push(line);
      from.push(i);
      i++;
      continue;
    }

    // Drop a comment, through the line that closes it.
    if (COMMENT_START_RE.test(line)) {
      let at = line.indexOf('<!--') + 4;
      while (i < lines.length && !lines[i].includes('-->', at)) {
        i++;
        at = 0;
      }
      i++;
      continue;
    }

    const found = asideOf(line, key);
    if (!found) {
      out.push(line);
      from.push(i);
      i++;
      continue;
    }

    // An aside written straight under a line of text, rather than after a
    // blank, comments on that line from inside its paragraph: the line after
    // it is the paragraph going on, not the aside wrapping, and a blank after
    // it still ends the paragraph.
    const within = out.length > 0 && out[out.length - 1].trim() !== '';

    // Collect the aside: its first line, plus any continuation lines. A
    // continuation is a non-blank line that is either indented past the `~`,
    // prefixed with its own `~`, or (after a blank) plain prose lazily wrapped
    // onto the next line. Anything that starts a new block ends the aside.
    const markerIndent = indentOf(line);
    const am = found.m;
    const first = (am[5] || '').trim();
    const head = am[0].length - am[1].length - (am[5] || '').length;
    const contentIndent = expandTabs(line).indexOf('~') + head + 1;
    const body = [first];
    const startLine = i;
    i++;

    while (i < lines.length) {
      const next = lines[i];
      if (!next.trim()) break;
      if (FENCE_RE.test(next)) break;
      // A fresh `~` starts a fresh thought. Two tildes in a row are two
      // separate asides that happen to share an anchor -- they will sit in the
      // same cell, each keeping its own mark. A continuation line with no `~`
      // is instead a wrapped line of the *same* thought.
      if (asideOf(next, key)) break;
      const ind = indentOf(next);
      if (ind > markerIndent || (!within && !BLOCK_START_RE.test(next))) {
        body.push(expandTabs(next).slice(Math.min(ind, contentIndent)));
        i++;
        continue;
      }
      break;
    }

    // Swallow one blank line after the aside so removing it does not leave a
    // double blank that would loosen or split the surrounding list -- unless
    // there was none before it, when that blank is all that keeps what comes
    // next from joining the paragraph above.
    if (!within && i < lines.length && !lines[i].trim()) i++;

    asides.push({
      anchor: out.length,
      text: body.join('\n').replace(/\s+$/, ''),
      line: startLine,
      ...(found.by && { by: found.by }),
      ...(found.select && { select: found.select, within }),
    });
  }

  return { meta, source: out.join('\n'), asides, lines: from, key };
}
