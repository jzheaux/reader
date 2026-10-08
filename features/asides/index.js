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
    // A deck's slide is rendered on its own, under the deck's key.
    const { meta, source, asides, lines, key } = preprocess(state.src, { key: state.env.asideKey });
    state.src = source.endsWith('\n') ? source : source + '\n';
    state.env.frontMatter = meta;
    state.env.asides = asides;
    state.env.asideKey = key;
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

  md.renderer.rules.aside_open = (tokens, i) => {
    const by = tokens[i].meta?.by;
    return by ? `<aside class="gm-aside gm-attributed"${byStyle(by)}>${byChips(by)}` : '<aside class="gm-aside">';
  };
  md.renderer.rules.aside_close = () => '</aside>\n';
}

/** Build the token run for one aside's content. */
export function asideTokens(md, aside, env) {
  const open = new Token('aside_open', 'aside', 1);
  open.block = true;
  if (aside.by) open.meta = { by: aside.by };
  const close = new Token('aside_close', 'aside', -1);
  close.block = true;

  // Parse the aside body as markdown in its own right, so **emphasis**,
  // `code`, links and even nested lists work inside a thought. Link reference
  // definitions carry over; the aside bookkeeping deliberately does not.
  const inner = md.parse(aside.text, { ...env, asides: null, __aside: true });
  return [open, ...inner, close];
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** An attributed aside's colour, its reviewer's: a style attribute, or ''. */
export function byStyle(by) {
  return by.who ? ` style="--by: ${escapeHtml(by.who.color)}"` : '';
}

/**
 * Who an aside is from and what it's about, as chips: the reviewer's name,
 * a pill for each topic, and each alias that isn't declared, with a `?`.
 */
export function byChips(by) {
  const chips = [];
  if (by.who) chips.push(`<span class="gm-who">${escapeHtml(by.who.name)}</span>`);
  for (const t of by.topics) chips.push(`<span class="gm-topic" style="--topic: ${escapeHtml(t.color)}">${escapeHtml(t.name)}</span>`);
  for (const c of by.unknown) chips.push(`<span class="gm-unknown" title="Not declared in the front matter">${escapeHtml(c)}?</span>`);
  return `<span class="gm-by">${chips.join('')}</span>`;
}

/**
 * Who and what a document's asides are from and about, with how many of
 * each, in the order they're declared: a legend for the masthead, or ''.
 */
export function legend(asides, key) {
  const counts = new Map();
  for (const a of asides) {
    if (!a.by) continue;
    for (const e of [a.by.who, ...a.by.topics].filter(Boolean)) counts.set(e, (counts.get(e) || 0) + 1);
  }
  if (!counts.size) return '';
  const used = [...(key?.values() || [])].filter((e) => counts.has(e));
  const chip = (e) => e.kind === 'reviewer'
    ? `<span class="gm-who" style="--by: ${escapeHtml(e.color)}">${escapeHtml(e.name)} <b>${counts.get(e)}</b></span>`
    : `<span class="gm-topic" style="--topic: ${escapeHtml(e.color)}">${escapeHtml(e.name)} <b>${counts.get(e)}</b></span>`;
  return `<div class="gm-legend">${used.map(chip).join('')}</div>`;
}

export default {
  name: 'asides',
  // reader lays the asides out in columns of their own.
  plugin: (md) => asides(md, { inline: false }),
  // First of all: other features place what they read before the asides
  // come out (`aside_extract`), so it must be there to place them by.
  raw: true,
};
