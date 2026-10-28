/**
 * What's behind a page: `background:` in the front matter, a color, an
 * image, or both, in either order:
 *
 *   ---
 *   background: images/paper.jpg
 *   ---
 *
 * In a deck that's behind every slide, and a slide can say otherwise with
 * the same line in its notes, where `slides` won't show it:
 *
 *   <!-- background: midnightblue -->
 *   <!-- background: images/stars.jpg black -->
 *   <!-- background: none -->
 *
 * A color is a CSS color name or `#hex`. An image is a path, from the
 * note, or a URL, ending in an image's extension; it covers the page, with
 * the color under it. Anything else isn't a background, so a note that
 * reads "background: he grew up in Ohio" stays a note.
 *
 * The background is an element behind the page (`.gm-bg`) rather than a
 * style on it, so it travels in the body the frame is handed. The frame
 * turns the text light when that reads better on the color (static/ink.js).
 */

import { COLORS } from '../features/names.js';
import { escapeAttr } from '../features/source.js';

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif)(?:[?#]\S*)?$/i;
const DIRECTIVE = /^[ \t]*background[ \t]*:[ \t]*(.+?)[ \t]*$/i;

/**
 * `midnightblue`, `images/stars.jpg black`, `none` -> `{ color, image }`,
 * either of which may be missing, and both for `none`; or null when it
 * doesn't read as a background.
 */
export function readBackground(value) {
  const text = String(value ?? '').trim().replace(/^(["'])(.*)\1$/, '$2');
  if (!text) return null;
  if (text.toLowerCase() === 'none') return {};
  let color;
  const rest = [];
  for (const word of text.split(/\s+/)) {
    if (!color && (COLORS.has(word.toLowerCase()) || HEX.test(word))) color = word.toLowerCase();
    else rest.push(word);
  }
  const image = rest.join(' ');
  if (image && !IMAGE.test(image)) return null;
  return { ...(color && { color }), ...(image && { image }) };
}

/**
 * A slide's notes without their `background:` line, and what it said:
 * `{ notes, background }`, `background` undefined when no line did.
 */
export function liftBackground(notes) {
  let background;
  const kept = notes.split('\n').filter((line) => {
    const m = DIRECTIVE.exec(line);
    const read = m && readBackground(m[1]);
    if (!read) return true;
    background = read;
    return false;
  });
  return { notes: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), background };
}

/** The element that draws `background` behind the page, or `''` for none. */
export function backdrop(background) {
  const { color, image } = background || {};
  if (!color && !image) return '';
  const css = [
    color && `background-color: ${color}`,
    // Quoted, so only a quote or a backslash could end it early.
    image && `background-image: url("${image.replace(/["\\]/g, encodeURIComponent)}")`,
  ].filter(Boolean).join('; ');
  return `<div class="gm-bg" style="${escapeAttr(css)}"></div>\n`;
}

// Fixed to the window, so a long page scrolls over it. On a dark color the
// page takes the dark colours (src/columns.css), its code, tables and
// alerts too.
export const CSS = `
.gm-bg { position: fixed; inset: 0; z-index: -1; background: center / cover no-repeat; }
`;
