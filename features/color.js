/**
 * The colours an author names, for the features that draw in them: an
 * aside's reviewer or topic (features/asides/key.js), and a mark
 * (features/mark.js). A common name is drawn in the family's hue for it
 * (src/columns.css), which reads as text on the page, light or dark, and
 * the page on it; any other colour, a `#hex` or a name not listed, is drawn
 * as it's written, and the page keeps it readable.
 */

// The colour names an author is likely to write, each to the family's hue
// nearest it. The family's green is a teal, so a plain green is its moss.
const FAMILY = {
  red: ['red', 'crimson', 'maroon'],
  amber: ['amber', 'orange', 'gold', 'yellow', 'brown'],
  moss: ['moss', 'green', 'lime', 'olive'],
  green: ['teal', 'cyan', 'turquoise'],
  blue: ['blue', 'navy'],
  violet: ['violet', 'purple', 'indigo'],
  rose: ['rose', 'pink', 'magenta'],
  slate: ['slate', 'grey', 'gray'],
};
const HUES = new Map(Object.entries(FAMILY).flatMap(([hue, names]) => names.map((n) => [n, `var(--gm-${hue})`])));

/**
 * A colour an author names -> the family's hue for it, which reads as text
 * in light and dark (`gold` -> `var(--gm-amber)`); any other, a `#hex` or a
 * name not listed, as it's written, for the page to keep readable
 * (src/columns.css).
 */
export function inFamily(color) {
  return (color && HUES.get(color.toLowerCase())) || color;
}

/**
 * Whether `color` is one an author wrote that isn't the family's: a `#hex`,
 * or a name not listed. The page keeps that one readable, and draws the
 * family's exactly as it's defined (src/columns.css).
 */
export function ownColor(color) {
  return Boolean(color) && !color.startsWith('var(--gm-');
}
