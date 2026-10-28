/**
 * What every page has taken off before the features read it: its front
 * matter and its HTML comments. The rest of the source is left for markdown,
 * with, for each line of it, the line of the file it came from.
 *
 * A front matter line a feature claims (its `matter(line)`, features/index.js)
 * is that feature's entry, not the page's meta: `reviewer #: Josh` is an
 * alias for the asides feature, not a line of the byline. Only the features
 * the page is rendered with claim lines; one left out claims none, and its
 * lines are the page's (see src/columns.js for how they show).
 */

import { frontMatter, fenced } from '../features/source.js';
import { FEATURES } from '../features/index.js';

// An HTML comment on lines of its own. The renderer takes no HTML, so it would
// otherwise show as text; it's dropped instead, asides and all, which makes it
// the place for a note to whoever opens the file, such as how to review it.
const COMMENT_START_RE = /^ {0,3}<!--/;

/**
 * A front matter line -> the entry the first of `features` to claim it
 * makes of it, tagged with that feature's name (`{ feature: 'asides', ... }`),
 * or null when none does.
 */
export function matterEntry(line, features = FEATURES) {
  for (const f of features) {
    const e = f.matter?.(line);
    if (e) return { feature: f.name, ...e };
  }
  return null;
}

/**
 * @param {string} src a page as written
 * @param {object[]} [features] the features that may claim its front matter's lines
 * @returns {{meta: object, entries: object[], source: string, lines: number[]}}
 *   `meta` is the front matter's (static/markdown.js), and `entries` the
 *   lines of it features claimed (`matterEntry`). `source` is `src` with
 *   the front matter and comments taken off, and `lines` has, for each line
 *   of `source`, the 0-based line of `src` it came from. A comment inside
 *   fenced code is code, and is kept.
 */
export function extract(src, features = FEATURES) {
  const all = String(src).replace(/\r\n?/g, '\n').split('\n');
  // Josh's convention uses `-----`, but `---` works too.
  const matter = frontMatter(all, { entry: (line) => matterEntry(line, features) });
  let i = matter?.end ?? 0;
  if (matter) while (i < all.length && !all[i].trim()) i++;

  const out = [];
  const from = [];
  const code = fenced();
  while (i < all.length) {
    const line = all[i];
    if (!code(line) && COMMENT_START_RE.test(line)) {
      // Drop the comment, through the line that closes it.
      let at = line.indexOf('<!--') + 4;
      while (i < all.length && !all[i].includes('-->', at)) {
        i++;
        at = 0;
      }
      i++;
      continue;
    }
    out.push(line);
    from.push(i);
    i++;
  }
  return { meta: matter?.meta ?? {}, entries: matter?.entries ?? [], source: out.join('\n'), lines: from };
}

/**
 * Takes them off, as the first rule after normalizing (`page_extract`),
 * keeping the front matter on `env.frontMatter` and the entries features
 * claimed on `env.entries`. A part of a page with none of its own (a deck's
 * slide) keeps the `env.entries` it was given, its deck's. Token maps count
 * lines of what's left; `env.sourceLines[n]` is the line of the source that
 * line `n` of it came from. Features that read the file as written go before
 * this rule (`beforeExtract`, features/source.js). `features` are the ones
 * the page is rendered with, which may claim lines of its front matter.
 */
export function page(md, features = FEATURES) {
  md.core.ruler.after('normalize', 'page_extract', (state) => {
    // A note's own body, parsed nested (`env.nested`), was read with the rest.
    if (state.inlineMode || state.env.nested) return;
    const { meta, entries, source, lines } = extract(state.src, features);
    state.src = source.endsWith('\n') ? source : `${source}\n`;
    state.env.frontMatter = meta;
    state.env.entries = entries.length ? entries : (state.env.entries ?? []);
    state.env.sourceLines = lines;
  });
}
