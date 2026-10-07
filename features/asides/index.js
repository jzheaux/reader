/**
 * Asides: a line starting `~` is the reader's own voice, set beside the line
 * it reacts to rather than in the run of the text.
 *
 *   I continue to mourn things that I loved being in the stream of.
 *
 *   ~ Maybe a post about the music; go towards the music
 *
 *   md.use(asides)                   asides back in place, as <aside>s
 *   md.use(asides, { inline: false }) asides kept on env.asides, for a layout
 *
 * Adds two things to the parser:
 *   - `-----` front matter, exposed on `env.frontMatter`
 *   - `~ ...` asides, lifted out of the source before block parsing so they
 *     cannot disturb the document's structure, then re-inserted as
 *     `aside_open` / `inline` / `aside_close` tokens at the place they were
 *     written.
 *
 * Taking both out shifts the lines the block parser sees, so token maps
 * count lines of what's left; `env.sourceLines[n]` is the line of the source
 * that line `n` of it came from.
 *
 * With `{ inline: false }` the asides are extracted and recorded on
 * `env.asides` but not re-inserted, which is what reader's two-column layout
 * (src/columns.js) wants -- it needs the speaker's stream unbroken so it can
 * choose its own cut points.
 *
 * Came from gutter-md, which reader grew out of.
 */

import Token from 'markdown-it/lib/token.mjs';
import { preprocess } from './preprocess.js';
import { resolveInlineInsertions } from './split.js';

export function asides(md, opts = {}) {
  const inline = opts.inline !== false;

  md.core.ruler.after('normalize', 'aside_extract', (state) => {
    // `__aside` marks the recursive parse of an aside's own body; it has
    // already been stripped of its markers and must not be re-processed.
    if (state.inlineMode || state.env.__aside) return;
    const { meta, source, asides, lines } = preprocess(state.src);
    state.src = source.endsWith('\n') ? source : source + '\n';
    state.env.frontMatter = meta;
    state.env.asides = asides;
    // Token maps count lines of what's left; this traces them back.
    state.env.sourceLines = lines;
  });

  if (!inline) return;

  md.core.ruler.push('aside_insert', (state) => {
    // An aside's body is parsed with this same `md`. Without this guard it
    // would inherit the outer document's aside list and re-insert it, forever.
    if (state.env.__aside) return;
    const asides = state.env.asides;
    if (!asides || !asides.length) return;

    const placed = resolveInlineInsertions(state.tokens, asides);
    // Insert from the back so earlier indices stay valid.
    for (const a of [...placed].sort((x, y) => y.at - x.at)) {
      state.tokens.splice(a.at, 0, ...asideTokens(md, a, state.env));
    }
  });

  md.renderer.rules.aside_open = () => '<aside class="gm-aside">';
  md.renderer.rules.aside_close = () => '</aside>\n';
}

/** Build the token run for one aside's content. */
export function asideTokens(md, aside, env) {
  const open = new Token('aside_open', 'aside', 1);
  open.block = true;
  const close = new Token('aside_close', 'aside', -1);
  close.block = true;

  // Parse the aside body as markdown in its own right, so **emphasis**,
  // `code`, links and even nested lists work inside a thought. Link reference
  // definitions carry over; the aside bookkeeping deliberately does not.
  const inner = md.parse(aside.text, { ...env, asides: null, __aside: true });
  return [open, ...inner, close];
}

export default {
  name: 'asides',
  // reader lays the asides out in columns of their own.
  plugin: (md) => asides(md, { inline: false }),
  // First of all: other features place what they read before the asides
  // come out (`aside_extract`), so it must be there to place them by.
  raw: true,
};
