/**
 * Asides: a line starting `~` is the reader's own voice, set beside the line
 * it reacts to rather than in the run of the text.
 *
 *   I continue to mourn things that I loved being in the stream of.
 *
 *   ~ Maybe a post about the music; go towards the music
 *
 * Adds two things to the parser:
 *   - `-----` front matter, exposed on `env.frontMatter`
 *   - `~ ...` asides, lifted out of the source before block parsing so they
 *     cannot disturb the document's structure, and kept on `env.asides` for
 *     reader's two-column layout (src/columns.js), which wants the speaker's
 *     stream unbroken so it can choose its own cut points.
 *
 * Taking both out shifts the lines the block parser sees, so token maps
 * count lines of what's left; `env.sourceLines[n]` is the line of the source
 * that line `n` of it came from.
 *
 * Once everything else has parsed the page, it marks the words an aside
 * names in brackets (`~a[quick]`) in the line it's written under, and ties
 * the aside to them by a line (marks.js, preview.js).
 *
 * Came from gutter-md, which reader grew out of.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { preprocess } from './preprocess.js';
import { marks } from './marks.js';
import { escapeHtml } from '../source.js';
import { ownColor } from '../color.js';

export function asides(md) {
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
}

/** The tokens of one aside's content. */
export function asideTokens(md, aside, env) {
  // Parse the aside body as markdown in its own right, so **emphasis**,
  // `code`, links and even nested lists work inside a thought. Link reference
  // definitions carry over; the aside bookkeeping deliberately does not.
  return md.parse(aside.text, { ...env, asides: null, __aside: true });
}

// A chip's or a pill's class, `gm-own` for a colour an author wrote that
// isn't the family's, for the page to keep readable (src/columns.css).
const chipClass = (kind, color) => `${kind}${ownColor(color) ? ' gm-own' : ''}`;

/**
 * Who an aside is from and what it's about, as chips: the reviewer's name,
 * a pill for each topic, and each alias that isn't declared, with a `?`.
 */
export function byChips(by) {
  const chips = [];
  if (by.who) chips.push(`<span class="${chipClass('gm-who', by.who.color)}">${escapeHtml(by.who.name)}</span>`);
  for (const t of by.topics) chips.push(`<span class="${chipClass('gm-topic', t.color)}" style="--topic: ${escapeHtml(t.color)}">${escapeHtml(t.name)}</span>`);
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
    ? `<span class="${chipClass('gm-who', e.color)}" style="--by: ${escapeHtml(e.color)}">${escapeHtml(e.name)} <b>${counts.get(e)}</b></span>`
    : `<span class="${chipClass('gm-topic', e.color)}" style="--topic: ${escapeHtml(e.color)}">${escapeHtml(e.name)} <b>${counts.get(e)}</b></span>`;
  return `<div class="gm-legend">${used.map(chip).join('')}</div>`;
}

export default {
  name: 'asides',
  // reader lays the asides out in columns of their own.
  plugin: asides,
  // First of all: other features place what they read before the asides
  // come out (`aside_extract`), so it must be there to place them by.
  raw: true,
  // Last of all: the words an aside chooses are found in what the others
  // leave as text, tabs' among them (marks.js).
  late: marks,
  css: fs.readFileSync(new URL('./marks.css', import.meta.url), 'utf8'),
  // The line from a mark to the asides about it.
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
};
