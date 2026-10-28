/**
 * The page's layout: two columns, the speaker's words in one and the
 * reader's asides in the other, each aside level with the passage it was
 * written against; above them, the masthead from the front matter and, when
 * the document names its voices, the column headings.
 *
 * Features leave notes for the margin on `env.margin`, and the speaker's
 * tokens unbroken. Each note is `{ anchor, render(attrs) }`: the line of the
 * cleaned source it goes before, and its cell, given the attributes the
 * block it's beside is tagged with (`noteAttrs`, features/source.js); the
 * asides feature's `~` lines are such notes. Here the tokens
 * are cut into rows (splitPairs, features/rows.js) and each row is drawn
 * beside its notes. What else goes in the masthead, under the byline, is on
 * `env.masthead` (the asides' legend). Came from gutter-md, which reader
 * grew out of.
 */

import fs from 'node:fs';
import { splitPairs, noteAttrs } from '../features/rows.js';
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

/**
 * Lay out a parsed document in two columns: the masthead, the column
 * headings, and each passage of the speaker's beside the notes in the
 * margin about it.
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
  const pairs = splitPairs(tokens, env.margin || []);
  const docTitle = title || meta.title || 'Notes';

  const speakerLabel = meta.speaker || 'Speaker';
  const listenerLabel = meta.listener || meta.author || 'Listener';

  const body = pairs
    .map((pair) => {
      const speakerHtml = pair.speaker.length
        ? md.renderer.render(pair.speaker, md.options, env)
        : '';
      // Each with what its block gives a note: written in a tab, it shows
      // while that tab does (features/tabs).
      const asideHtml = pair.asides.map((note) => note.render(noteAttrs(tokens, note.anchor))).join('\n');
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
    body: `<div class="gm-doc">\n${masthead(meta, docTitle, (env.masthead || []).join('\n  '))}\n${colheads}\n${body}\n</div>`,
  };
}

function masthead(meta, docTitle, more = '') {
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
  ${bits.length ? `<div class="gm-byline">${bits.join('')}</div>` : ''}${more ? `\n  ${more}` : ''}
</header>`;
}
