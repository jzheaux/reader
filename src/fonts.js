/**
 * A document's own type, from its front matter: one font for what it says
 * and, if the titles are to differ, one for them:
 *
 *   ---
 *   font: avenir-next
 *   title-font: playfair-display georgia
 *   ---
 *
 * A font is named as it is in a `{…}` style (features/styles): hyphens for
 * its spaces, in any case. More than one are tried in order, and the page's
 * own serif comes after them. `font:` sets the text, titles included; `title-font:` sets
 * the headings, the masthead's and a slide's among them. Asides, captions
 * and code keep their own faces: they're told apart by them.
 */

import { GENERIC } from '../features/names.js';

/** `avenir-next serif` -> `'avenir next', serif`, or `''` when no name in it reads as one. */
export function fontFamily(value) {
  return String(value ?? '').split(/[\s,]+/)
    .filter((name) => /^\w[\w.-]*$/.test(name))
    .map((name) => (GENERIC.has(name.toLowerCase()) ? name.toLowerCase() : `'${name.replace(/-/g, ' ')}'`))
    .join(', ');
}

/** The stylesheet for front matter's `font:` and `title-font:`, or `''` for neither. */
export function fontCss(meta = {}) {
  const text = fontFamily(meta.font);
  const titles = fontFamily(meta['title-font']);
  return [
    text && `body { font-family: ${text}, var(--gm-serif); }`,
    titles && `h1, h2, h3, h4, h5, h6 { font-family: ${titles}, var(--gm-serif); }`,
  ].filter(Boolean).join('\n');
}
