/**
 * `search:` makes a Google search, for something to look into later. It
 * shows with a dotted underline and a ⌕. Spaces in the bracket become `+` in
 * the query, so these are the same search:
 *
 *   search:[My Many Worded Term]
 *   search:my+many+worded+term[My Many Worded Term]
 */

import fs from 'node:fs';
import { schemeLinks } from '../scheme.js';

const GOOGLE = 'https://www.google.com/search?q=';

export function searchLink(q, label) {
  const text = label.trim();
  const terms = q
    ? q.split('+').map((t) => { try { return decodeURIComponent(t); } catch { return t; } })
    : text.split(/\s+/);
  const words = terms.filter(Boolean);
  if (!words.length) return null;
  return { href: GOOGLE + words.map(encodeURIComponent).join('+'), label: text || words.join(' ') };
}

export function search(md) {
  schemeLinks(md, {
    name: 'search',
    scheme: 'search',
    path: /[^\s[\]]*/,
    link: (q, label) => {
      const found = searchLink(q, label);
      return found && { ...found, attrs: [['class', 'search']] };
    },
  });
}

export default {
  name: 'search',
  plugin: search,
  css: fs.readFileSync(new URL('./search.css', import.meta.url), 'utf8'),
};
