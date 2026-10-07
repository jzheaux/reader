/**
 * `scripture:` makes a link to Blue Letter Bible, in the RSV unless a version
 * follows a comma:
 *
 *   scripture:[Isaiah 2:1-5]          -> blueletterbible.org/rsv/isaiah/2/1-5
 *   scripture:[Isaiah 2:1-5, NIV]     -> blueletterbible.org/niv/isaiah/2/1-5
 *   scripture:isaiah/2/1-5[plowshares] -> the same, labelled "plowshares"
 *
 * The file keeps what was typed. Bracketed text that doesn't read as
 * `Book ch[:vs]` is left as written, and so is anything in code.
 */

import { schemeLinks } from '../scheme.js';

const BLB = 'https://www.blueletterbible.org';
const DEFAULT_VERSION = 'rsv';
const WITH_VERSION = /^(.+?)(?:\s*,\s*([a-z0-9]+))?$/i;
const REFERENCE = /^((?:[1-3]\s*)?[a-z][a-z .]*?)\s+(\d+)(?::([\d\s,\-\u2013]+))?$/i;

export function scriptureLink(p, label) {
  const where = p.replace(/^\/+|\/+$/g, '');
  const text = label.trim();
  if (where) return { href: `${BLB}/${DEFAULT_VERSION}/${where}`, label: text || where };
  const [, ref, version = DEFAULT_VERSION] = WITH_VERSION.exec(text) ?? [];
  const r = ref && REFERENCE.exec(ref.trim());
  if (!r) return null;
  const book = r[1].replace(/[\s.]+/g, '').toLowerCase();
  let href = `${BLB}/${version.toLowerCase()}/${book}/${r[2]}`;
  if (r[3]) href += '/' + r[3].replace(/\s+/g, '').replace(/\u2013/g, '-');
  return { href, label: text };
}

export function scripture(md) {
  schemeLinks(md, { name: 'scripture', scheme: 'scripture', path: /[\w/.:-]*/, link: scriptureLink });
}

export default {
  name: 'scripture',
  plugin: scripture,
};
