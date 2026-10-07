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

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;
const FRONT_MATTER_RE = /^-{3,}\s*$/;
const META_RE = /^\s*([A-Za-z][A-Za-z0-9 _-]*?)\s*:\s*(.*)$/;

// A `~` on its own, or followed by whitespace. `~~strike~~` and the `~~~` fence
// are both excluded by requiring the next character not to be another tilde.
const ASIDE_RE = /^([ \t]*)~(?!~)([ \t]+.*)?$/;

// Lines that begin a block the aside should not swallow as a lazy continuation.
const BLOCK_START_RE = /^[ \t]*(?:[*+-][ \t]|\d+[.)][ \t]|#{1,6}[ \t]|>|```|~{3,}|-{3,}\s*$|_{3,}\s*$)/;

function expandTabs(line) {
  return line.replace(/\t/g, '    ');
}

function indentOf(line) {
  return expandTabs(line).match(/^ */)[0].length;
}

/**
 * @param {string} src raw document text
 * @returns {{meta: object, matter: string, source: string, asides: Array<{anchor: number, text: string, line: number}>}}
 *   `source` is the document with front matter and aside lines removed;
 *   `matter` is the front matter block exactly as it was written, delimiters
 *   included, for consumers that would rather pass it through than re-serialize
 *   `meta` (`''` when there is none);
 *   `anchor` is an index into `source`'s lines -- the aside belongs immediately
 *   before that line; `line` is the aside's 0-based line in the original file.
 *   `lines` has, for each line of `source`, the 0-based line of the original
 *   it came from, so positions in `source` can be traced back to the file.
 */
export function preprocess(src) {
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  const meta = {};
  let matter = '';
  let i = 0;

  // --- front matter -------------------------------------------------------
  // Josh's convention uses `-----`, but any run of three or more dashes works,
  // so ordinary YAML-style `---` fences are accepted too.
  if (lines.length && FRONT_MATTER_RE.test(lines[0])) {
    let end = 1;
    while (end < lines.length && !FRONT_MATTER_RE.test(lines[end])) end++;
    if (end < lines.length) {
      for (const line of lines.slice(1, end)) {
        const m = META_RE.exec(line);
        if (m) meta[m[1].trim().toLowerCase()] = m[2].trim();
      }
      matter = lines.slice(0, end + 1).join('\n');
      i = end + 1;
      while (i < lines.length && !lines[i].trim()) i++;
    }
  }

  // --- asides -------------------------------------------------------------
  const out = [];
  const from = [];
  const asides = [];
  let fence = null;

  while (i < lines.length) {
    const line = lines[i];

    // Never look inside fenced code.
    const fm = FENCE_RE.exec(line);
    if (fence) {
      if (fm && fm[1][0] === fence[0] && fm[1].length >= fence.length) fence = null;
      out.push(line);
      from.push(i);
      i++;
      continue;
    }
    if (fm) {
      fence = fm[1];
      out.push(line);
      from.push(i);
      i++;
      continue;
    }

    const am = ASIDE_RE.exec(line);
    if (!am) {
      out.push(line);
      from.push(i);
      i++;
      continue;
    }

    // Collect the aside: its first line, plus any continuation lines. A
    // continuation is a non-blank line that is either indented past the `~`,
    // prefixed with its own `~`, or plain prose lazily wrapped onto the next
    // line. Anything that starts a new block ends the aside.
    const markerIndent = indentOf(line);
    const first = (am[2] || '').trim();
    const contentIndent = expandTabs(line).indexOf('~') + 2;
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
      if (ASIDE_RE.test(next)) break;
      const ind = indentOf(next);
      if (ind > markerIndent || !BLOCK_START_RE.test(next)) {
        body.push(expandTabs(next).slice(Math.min(ind, contentIndent)));
        i++;
        continue;
      }
      break;
    }

    // Swallow one blank line after the aside so removing it does not leave a
    // double blank that would loosen or split the surrounding list.
    if (i < lines.length && !lines[i].trim()) i++;

    asides.push({
      anchor: out.length,
      text: body.join('\n').replace(/\s+$/, ''),
      line: startLine,
    });
  }

  return { meta, matter, source: out.join('\n'), asides, lines: from };
}
