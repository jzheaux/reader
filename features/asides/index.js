/**
 * Asides: a line starting `~` is the reader's own voice, set beside the line
 * it reacts to rather than in the run of the text.
 *
 *   I continue to mourn things that I loved being in the stream of.
 *
 *   ~ Maybe a post about the music; go towards the music
 *
 * Once the page's front matter and comments are off (src/page.js), the
 * asides are lifted out of the source before block parsing, so they cannot
 * disturb the document's structure, and kept on `env.asides`. Each is a
 * note in the page's margin (`env.margin`, src/columns.js), which wants the
 * speaker's stream unbroken so it can choose its own cut points; the
 * feature draws its cell (`cell`). The aliases they may use,
 * `reviewer #: Josh` and `topic c: Coherence`, are the front matter lines
 * the feature claims (`matter`), and make the key on `env.asideKey`; who
 * and what the asides are from and about goes in the masthead
 * (`env.masthead`), as a legend.
 *
 * Taking them out shifts the lines the block parser sees again, so the
 * feature traces `env.sourceLines` on through what it took.
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
import { readEntry, makeKey } from './key.js';
import { marks, about } from './marks.js';
import { escapeHtml } from '../source.js';
import { ownColor } from '../color.js';

export function asides(md) {
  const rule = (state) => {
    // `__aside` marks the recursive parse of an aside's own body; it has
    // already been stripped of its markers and must not be re-processed.
    if (state.inlineMode || state.env.__aside) return;
    // The aliases the front matter declares, or a deck's, for one slide of it.
    const key = makeKey((state.env.entries ?? []).filter((e) => e.feature === 'asides'));
    const { source, asides, lines } = preprocess(state.src, key);
    state.src = source.endsWith('\n') ? source : source + '\n';
    // Each aside's line, and each line left, traced back to the file
    // through the page's own trace.
    const page = state.env.sourceLines ?? [];
    for (const a of asides) a.line = page[a.line] ?? a.line;
    state.env.sourceLines = lines.map((k) => page[k] ?? k);
    state.env.asides = asides;
    state.env.asideKey = key;
    // Each one a note in the margin, its cell drawn as the page is laid
    // out, once every rule has run, so the words it chose are marked by then.
    const { md, env } = state;
    env.margin = [...(env.margin ?? []), ...asides.map((aside) => ({ anchor: aside.anchor, render: (attrs) => cell(md, aside, env, attrs) }))];
    const shown = legend(asides, key);
    if (shown) env.masthead = [...(env.masthead ?? []), shown];
  };
  // After the page's front matter and comments are off, or after
  // normalizing when there's no such rule (a test of the feature alone).
  try {
    md.core.ruler.after('page_extract', 'aside_extract', rule);
  } catch {
    md.core.ruler.after('normalize', 'aside_extract', rule);
  }
}

/**
 * An aside's cell in the margin, with `attrs`, the attributes the page
 * gives it (` data-in-tab="2"`, for one that shows with a tab).
 */
function cell(md, aside, env, attrs = '') {
  const html = md.renderer.render(asideTokens(md, aside, env), md.options, env);
  // The words it's about, if it chose some (marks.js), follow who it's
  // from and what it's about, or its `~`.
  const words = about(aside.mark);
  const tied = aside.mark?.id;
  const style = [aside.by?.who && `--by: ${escapeHtml(aside.by.who.color)}`, tied && aside.mark.color && `--mk: ${escapeHtml(aside.mark.color)}`].filter(Boolean).join('; ');
  attrs = `${style ? ` style="${style}"` : ''}${tied ? ` data-mark="${escapeHtml(tied)}"` : ''}${attrs}`;
  // An attributed aside opens with who it's from and what it's about, at the
  // start of its first paragraph, or above it when it doesn't open with one.
  if (aside.by) {
    const chips = byChips(aside.by) + words;
    const opened = /^<p\b/.test(html) ? html.replace(/^<p\b([^>]*)>/, `<p$1>${chips}`) : `${chips}\n${html}`;
    return `<div class="gm-aside-cell gm-attributed" role="note"${attrs}>\n${opened}</div>`;
  }
  // Slip the `~` in front of the first line of prose so the mark survives into
  // the printed page. It's seen, not read: the aside is a note.
  const lead = `<span class="gm-mark" aria-hidden="true">~</span>${words}`;
  const marked = /<p\b/.test(html) ? html.replace(/<p\b([^>]*)>/, `<p$1>${lead}`) : words ? `<p>${lead}</p>\n${html}` : html;
  return `<div class="gm-aside-cell" role="note"${attrs}>\n${marked}</div>`;
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
  // Claims the front matter's `reviewer #: Josh` and `topic c: Coherence`.
  matter: readEntry,
  // Last of all: the words an aside chooses are found in what the others
  // leave as text, tabs' among them (marks.js).
  late: marks,
  css: fs.readFileSync(new URL('./marks.css', import.meta.url), 'utf8'),
  // The line from a mark to the asides about it.
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
};
