/**
 * The page's layout: two columns, the speaker's words in one and the
 * reader's asides in the other, each aside level with the passage it was
 * written against; above them, the masthead from the front matter and, when
 * the document names its voices, the column headings.
 *
 * The asides feature (features/asides) parses with `{ inline: false }`, so
 * the speaker's tokens come unbroken and the asides wait on `env.asides`;
 * here the tokens are cut into rows (splitPairs) and each row is drawn
 * beside its asides. Came from gutter-md, which reader grew out of.
 */

import fs from 'node:fs';
import { asideTokens } from '../features/asides/index.js';
import { splitPairs } from '../features/asides/split.js';

const CSS = fs.readFileSync(new URL('./columns.css', import.meta.url), 'utf8');

/** The layout's stylesheet. */
export function themeCss() {
  return CSS;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function renderAsideCell(md, aside, env, showMark) {
  const html = md.renderer.render(asideTokens(md, aside, env).slice(1, -1), md.options, env);
  // Slip the `~` in front of the first line of prose so the mark survives into
  // the printed page.
  const marked = showMark
    ? html.replace(/<p\b([^>]*)>/, '<p$1><span class="gm-mark">~</span>')
    : html;
  return `<div class="gm-aside-cell">\n${marked}</div>`;
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
 * @param {number} [opts.ratio=0.62] width of the aside column relative to the speaker's
 * @param {boolean} [opts.swap=false] put the asides in the left column
 * @param {boolean} [opts.headings=true] show the column headings
 * @param {boolean} [opts.mark=true] keep a visible `~` on each aside
 * @param {string} [opts.css] more CSS after the layout's own
 * @param {string} [opts.title]
 * @returns {{css: string, body: string, title: string}}
 */
export function columns(md, tokens, env, opts = {}) {
  const {
    ratio = 0.62,
    swap = false,
    headings = true,
    mark = true,
    css = '',
    title,
  } = opts;
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
      const asideHtml = pair.asides.map((a) => renderAsideCell(md, a, env, mark)).join('\n');
      const cells = [
        `<div class="gm-speaker">\n${speakerHtml}</div>`,
        asideHtml ? `<div class="gm-asides">\n${asideHtml}\n</div>` : '<div></div>',
      ];
      if (swap) cells.reverse();
      return `<section class="gm-pair">\n${cells.join('\n')}\n</section>`;
    })
    .join('\n');

  const colheads = headings
    ? `<div class="gm-colheads">${
        (swap
          ? [`<div class="gm-h-aside">${escapeHtml(listenerLabel)}</div>`, `<div>${escapeHtml(speakerLabel)}</div>`]
          : [`<div>${escapeHtml(speakerLabel)}</div>`, `<div class="gm-h-aside">${escapeHtml(listenerLabel)}</div>`]
        ).join('')
      }</div>`
    : '';

  const vars = swap
    ? `--gm-speaker-col: ${ratio}fr; --gm-aside-col: 1fr;`
    : `--gm-speaker-col: 1fr; --gm-aside-col: ${ratio}fr;`;

  return {
    title: docTitle,
    css: `${themeCss()}\n:root{${vars}}\n${css}`,
    body: `<div class="gm-doc">\n${masthead(meta, docTitle)}\n${colheads}\n${body}\n</div>`,
  };
}

function masthead(meta, docTitle) {
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
    .filter(([k]) => !['title', 'author', 'date', 'tags', 'speaker', 'listener'].includes(k))
    .map(([k, v]) => `<span>${escapeHtml(k)}: ${escapeHtml(v)}</span>`);
  bits.push(...extras);

  return `<header class="gm-masthead">
  <h1 class="gm-title">${escapeHtml(docTitle)}</h1>
  ${bits.length ? `<div class="gm-byline">${bits.join('')}</div>` : ''}
</header>`;
}
