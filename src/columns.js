/**
 * The page's layout: two columns, the speaker's words in one and the
 * reader's asides in the other, each aside level with the passage it was
 * written against; above them, the masthead from the front matter and, when
 * the document names its voices, the column headings.
 *
 * The asides feature (features/asides) leaves the speaker's tokens
 * unbroken, the asides waiting on `env.asides`; here the tokens are cut into rows (splitPairs) and each row is drawn
 * beside its asides. Came from gutter-md, which reader grew out of.
 */

import fs from 'node:fs';
import { asideTokens, byChips, legend } from '../features/asides/index.js';
import { about } from '../features/asides/marks.js';
import { splitPairs, tabOf } from '../features/asides/split.js';
import { escapeHtml } from '../features/source.js';

const CSS = fs.readFileSync(new URL('./columns.css', import.meta.url), 'utf8');

// Front matter that's said elsewhere on the page, or is a setting, not
// something to read: how a deck is timed, moved through, paged and printed
// (src/slides.js, export.js), and what kind of document it is.
const UNSHOWN = new Set(['title', 'author', 'date', 'tags', 'speaker', 'listener', 'background', 'font', 'title-font', 'time', 'transition', 'paging', 'print', 'type']);

/** The layout's stylesheet. */
export function themeCss() {
  return CSS;
}

/**
 * The light colours' declarations, as columns.css sets them: what a page
 * goes back to where it's dark but mustn't be, as on paper (export.js).
 */
export const LIGHT_COLOURS = CSS.match(/\/\* colours, light \*\/\n:root \{([^}]*)\}/)[1].trim();

function renderAsideCell(md, aside, env, tab) {
  const html = md.renderer.render(asideTokens(md, aside, env), md.options, env);
  // The words it's about, if it chose some (features/asides/marks.js),
  // follow who it's from and what it's about, or its `~`.
  const words = about(aside.mark);
  const tied = aside.mark?.id;
  const style = [aside.by?.who && `--by: ${escapeHtml(aside.by.who.color)}`, tied && aside.mark.color && `--mk: ${escapeHtml(aside.mark.color)}`].filter(Boolean).join('; ');
  // Written in a tab, it shows while that tab does (features/tabs).
  const attrs = `${style ? ` style="${style}"` : ''}${tied ? ` data-mark="${escapeHtml(tied)}"` : ''}${tab ? ` data-in-tab="${tab}"` : ''}`;
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

/**
 * Lay out a parsed document in two columns: the masthead, the column
 * headings, and each passage of the speaker's beside the asides written
 * against it.
 *
 * @param {MarkdownIt} md the instance that parsed `tokens`
 * @param {Array} tokens
 * @param {object} env the env they were parsed with
 * @param {object} [opts]
 * @param {boolean} [opts.headings=true] show the column headings
 * @param {string} [opts.title]
 * @returns {{css: string, body: string, title: string}}
 */
export function columns(md, tokens, env, { headings = true, title } = {}) {
  const meta = env.frontMatter || {};
  const pairs = splitPairs(tokens, env.asides || []);
  const docTitle = title || meta.title || 'Notes';

  const speakerLabel = meta.speaker || 'Speaker';
  const listenerLabel = meta.listener || meta.author || 'Listener';

  const body = pairs
    .map((pair) => {
      const speakerHtml = pair.speaker.length
        ? md.renderer.render(pair.speaker, md.options, env)
        : '';
      const asideHtml = pair.asides.map((a) => renderAsideCell(md, a, env, tabOf(tokens, a.anchor))).join('\n');
      const cells = [
        `<div class="gm-speaker">\n${speakerHtml}</div>`,
        asideHtml ? `<div class="gm-asides">\n${asideHtml}\n</div>` : '<div></div>',
      ];
      return `<section class="gm-pair">\n${cells.join('\n')}\n</section>`;
    })
    .join('\n');

  const colheads = headings
    ? `<div class="gm-colheads"><div>${escapeHtml(speakerLabel)}</div><div class="gm-h-aside">${escapeHtml(listenerLabel)}</div></div>`
    : '';

  return {
    title: docTitle,
    css: themeCss(),
    body: `<div class="gm-doc">\n${masthead(meta, docTitle, legend(env.asides || [], env.asideKey))}\n${colheads}\n${body}\n</div>`,
  };
}

function masthead(meta, docTitle, legendHtml = '') {
  const bits = [];
  if (meta.author) bits.push(`<span>${escapeHtml(meta.author)}</span>`);
  if (meta.date) bits.push(`<span>${escapeHtml(meta.date)}</span>`);
  if (meta.tags) {
    const tags = meta.tags
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((t) => `<span class="gm-tag">#${escapeHtml(t)}</span>`)
      .join(' ');
    if (tags) bits.push(tags);
  }
  const extras = Object.entries(meta)
    // A key holding others (`multibox:`) is a setting, not something said.
    .filter(([k, v]) => !UNSHOWN.has(k) && typeof v === 'string')
    .map(([k, v]) => `<span>${escapeHtml(k)}: ${escapeHtml(v)}</span>`);
  bits.push(...extras);

  return `<header class="gm-masthead">
  <h1 class="gm-title">${escapeHtml(docTitle)}</h1>
  ${bits.length ? `<div class="gm-byline">${bits.join('')}</div>` : ''}${legendHtml ? `\n  ${legendHtml}` : ''}
</header>`;
}
