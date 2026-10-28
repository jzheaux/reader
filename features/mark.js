/**
 * Marks: words circled, underlined or highlighted, as on paper. The styles
 * feature draws one from the names in a style's braces (`[quick]{circle}`,
 * `[quick]{a highlight}`), and a feature may draw one for words it picks
 * out, as asides does for the words an aside chooses (`~a[quick]`). A
 * topic's alias marks the text in the topic's colour and style, from the
 * page's topics (`env.topics`, features/source.js); a style names how
 * it's drawn.
 */

import { inFamily } from './color.js';

/** How a mark can be drawn. */
export const STYLES = ['circle', 'underline', 'dotted', 'wavy', 'highlight'];

/**
 * The names in braces -> `{ style, topic, rest }`, the names that aren't
 * the mark's left in `rest`; or null when none of them is a mark's.
 * `topics` are the page's, by alias (`env.topics`): a topic is a declared
 * one's alias, one character, so `{a}` without one is a font, as it always
 * was.
 */
export function marking(names, topics) {
  let style = null;
  let topic = null;
  const rest = [];
  for (const name of names.trim().split(/\s+/)) {
    const declared = [...name].length === 1 ? topics?.get(name) : null;
    if (STYLES.includes(name.toLowerCase())) style ??= name.toLowerCase();
    else if (declared) topic ??= declared;
    else rest.push(name);
  }
  if (!style && !topic) return null;
  return { style: style ?? topic?.style ?? 'underline', topic, rest };
}

/**
 * Makes `token`, a span's opening, the mark: drawn in `style`, in `color` if
 * there is one (the family's hue for it, if it has one). It's a mark to a
 * screen reader, and its topic, if it has one, is said with it and shows on
 * hover, not only by its colour and pen.
 */
export function markSpan(token, { style, color, topic }) {
  color = inFamily(color);
  token.attrJoin('class', `mk mk-${style}`);
  token.attrSet('role', 'mark');
  if (topic) token.attrSet('title', topic);
  if (color) token.attrSet('style', `--mk: ${color}`);
  token.meta = { ...token.meta, mark: { style, color } };
}
