/**
 * A blockquote whose last line starts with `--` (or an em dash) takes that
 * line as its attribution, set right-aligned under the quote. Links, and
 * `scripture:`, work there as anywhere.
 *
 *   > The road of excess leads to the palace of wisdom.
 *   > -- [William Blake](https://en.wikipedia.org/wiki/The_Marriage_of_Heaven_and_Hell)
 *
 * The line is found before markdown reads the text, its dash left as a
 * marker; once parsed, the paragraph it opens is the attribution, or, if
 * the line carried on a paragraph, it's split off into one of its own, with
 * that paragraph's attributes (a `:::` block's style).
 */

import fs from 'node:fs';
import { beforeAsides, readLines, addClass } from '../source.js';

const ATTRIBUTION = /^([ \t]*(?:~[ \t]*)*(?:>[ \t]*)+)(?:--|\u2014)[ \t]+(?=\S)/;
const QUOTED = /^[ \t]*(?:~[ \t]*)*>/;
const BYLINE = '\uE007';

export function attributions(md) {
  beforeAsides(md, 'attribution_lines', (state) => readLines(state, (line, n, lines, i) => {
    const next = lines[i + 1];
    return next === undefined || !QUOTED.test(next) ? line.replace(ATTRIBUTION, `$1${BYLINE}`) : line;
  }));

  // After a `:::` block's style is on the paragraph, for a split to copy.
  md.core.ruler.push('attributions', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === 'code_block' || t.type === 'fence') t.content = t.content.replaceAll(BYLINE, '-- ');
      if (t.type !== 'inline' || !t.children) continue;
      const open = tokens[i - 1];
      // In an aside it stays as typed: the line is the reader's own.
      const shown = open?.type === 'paragraph_open' && !open.hidden && !state.env.__aside;
      const at = t.children.findIndex((c, k) => c.type === 'text' && c.content.startsWith(BYLINE)
        && (k === 0 || ['softbreak', 'hardbreak'].includes(t.children[k - 1].type)));
      if (shown && at === 0) {
        t.children[0].content = t.children[0].content.slice(BYLINE.length);
        addClass(open, 'quote-by');
      } else if (shown && at > 0) {
        i = split(state, i, at);
      }
      for (const c of tokens[i].children || []) if (c.type === 'text') c.content = c.content.replaceAll(BYLINE, '-- ');
    }
  });
}

/**
 * Splits the paragraph whose inline token is at `i` before child `at`, the
 * attribution: the rest goes in a paragraph of its own. Returns the index of
 * the new paragraph's inline token.
 */
function split(state, i, at) {
  const tokens = state.tokens;
  const inline = tokens[i];
  const [open, close] = [tokens[i - 1], tokens[i + 1]];
  // A soft break between them goes; a hard one stays, ending the paragraph.
  const soft = inline.children[at - 1].type === 'softbreak';
  const before = inline.children.slice(0, soft ? at - 1 : at);
  if (!soft) {
    const br = new state.Token('html_inline', '', 0);
    br.content = '<br>';
    before[before.length - 1] = br;
  }
  const after = inline.children.slice(at);
  after[0].content = after[0].content.slice(BYLINE.length);
  const copy = (t) => Object.assign(new state.Token(t.type, t.tag, t.nesting), t, { attrs: t.attrs?.map((a) => [...a]) ?? null });
  const byOpen = copy(open);
  addClass(byOpen, 'quote-by');
  const byInline = copy(inline);
  byInline.children = after;
  inline.children = before;
  tokens.splice(i + 1, 0, copy(close), byOpen, byInline);
  return i + 3;
}

export default {
  name: 'attributions',
  plugin: attributions,
  css: fs.readFileSync(new URL('./attributions.css', import.meta.url), 'utf8'),
};
