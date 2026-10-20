/**
 * A ```headline fence is set like a clipping from the paper it ran in: the
 * paper's name, the headline, and when it ran.
 *
 *   ```headline
 *   Sam Altman Says "Code Is Free," Then Hires 400 Engineers
 *
 *   A second paragraph, if there is one, is the line under the headline.
 *   agency: The New York Times
 *   date: October 3, 2026
 *   by: A. Reporter
 *   url: https://www.nytimes.com/2026/10/03/the-story.html
 *   ```
 *
 * The text is the headline, as written, so it needs no quoting; `agency:`,
 * `date:`, `by:` and `url:` lines, anywhere in the fence, say the rest, and
 * the headline links to the `url`. A paper reader knows (LOOKS) is set in
 * something like its own type, found by the agency's name or, without one,
 * by where the url points; any other gets a plain clipping.
 */

import fs from 'node:fs';
import MarkdownIt from 'markdown-it';
import { addClass, escapeAttr, escapeHtml } from '../source.js';

const { Token } = MarkdownIt;

const FIELD = /^[ \t]*(agency|date|by|url)[ \t]*:[ \t]*(.*?)[ \t]*$/i;

// A paper reader has a look for: what its name comes to without "the",
// spaces or case, where it's published, and what to call it when only the
// url says which it is.
const LOOKS = [
  { look: 'nyt', names: ['newyorktimes', 'nytimes', 'nyt'], host: 'nytimes.com', name: 'The New York Times' },
  { look: 'atlantic', names: ['atlantic'], host: 'theatlantic.com', name: 'The Atlantic' },
  { look: 'guardian', names: ['guardian'], host: 'theguardian.com', name: 'The Guardian' },
  { look: 'wired', names: ['wired'], host: 'wired.com', name: 'WIRED' },
  { look: 'slashdot', names: ['slashdot'], host: 'slashdot.org', name: 'Slashdot' },
];

/** A fence's text -> `{ title, deck, agency, date, by, url }`, each a string, `''` when not given. */
export function readHeadline(text) {
  const out = { title: '', deck: '', agency: '', date: '', by: '', url: '' };
  const paragraphs = [[]];
  for (const line of text.split('\n')) {
    const field = FIELD.exec(line);
    if (field) out[field[1].toLowerCase()] = field[2];
    else if (line.trim()) paragraphs.at(-1).push(line.trim());
    else if (paragraphs.at(-1).length) paragraphs.push([]);
  }
  const [title, ...deck] = paragraphs.filter((p) => p.length).map((p) => p.join(' '));
  return { ...out, title: title || '', deck: deck.join(' ') };
}

/** The paper an agency's name, or failing that a url, belongs to, from LOOKS; or undefined. */
export function lookFor(agency, url) {
  const name = agency.toLowerCase().replace(/[^a-z]/g, '').replace(/^the/, '');
  if (name) return LOOKS.find((l) => l.names.includes(name));
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  return LOOKS.find((l) => host === l.host || host.endsWith(`.${l.host}`));
}

export function headlines(md) {
  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, i, opts, env, self) => {
    const token = tokens[i];
    if (token.info.trim().split(/\s+/)[0] !== 'headline') return fence(tokens, i, opts, env, self);
    const h = readHeadline(token.content);
    if (!h.title) return fence(tokens, i, opts, env, self);
    const found = lookFor(h.agency, h.url);
    const agency = h.agency || found?.name || '';
    // The headline and the line under it are prose: quotes curl, emphasis shows.
    const inline = (text) => md.renderInline(text, { lineBase: 0, shared: {} });
    const href = /^https?:\/\//i.test(h.url) && md.validateLink(h.url) ? md.normalizeLink(h.url) : '';
    const title = href ? `<a href="${escapeAttr(href)}">${inline(h.title)}</a>` : inline(h.title);
    const dateline = [h.by && `By ${h.by}`, h.date].filter(Boolean).map(escapeHtml).join(' · ');

    const wrapper = Object.assign(new Token('div', 'div', 1), { attrs: token.attrs?.map((a) => [...a]) ?? null });
    addClass(wrapper, `headline headline-${found?.look || 'plain'}`);
    return [
      `<div${self.renderAttrs(wrapper)}>`,
      agency && `<p class="headline-agency">${escapeHtml(agency)}</p>`,
      `<p class="headline-title">${title}</p>`,
      h.deck && `<p class="headline-deck">${inline(h.deck)}</p>`,
      dateline && `<p class="headline-dateline">${dateline}</p>`,
      '</div>',
    ].filter(Boolean).join('\n') + '\n';
  };
}

export default {
  name: 'headline',
  plugin: headlines,
  css: fs.readFileSync(new URL('./headline.css', import.meta.url), 'utf8'),
};
