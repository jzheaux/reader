/**
 * Blanks: a place on the page to write into, as a form field is
 * (features/fields) and as a term heard but not yet looked up is
 * (features/definitions). Any feature can draw one, as
 *
 *   <span class="field" data-line data-text data-head>
 *     <span class="field-value" data-value ...typable(label, env)>value</span>
 *   </span>
 *
 * `data-line` is the line it's on, `data-text` that line as written, and
 * `data-head` what goes before the value when it's written back (`@ Notes:`,
 * `!SLAB:`). The fields feature's preview opens any blank for typing and
 * writes `head value` back to its line. Without fields, a blank is only read.
 *
 * And whether a page can be worked at all, where it's drawn, is asked here,
 * so that every feature drawing something to fill in or pick gets the same
 * answer. In the preview frame the same answer is `Preview.workable`
 * (static/preview-api.js), which every feature's clicks and keys go by.
 */

import { escapeAttr } from './source.js';

/**
 * Can the page be worked where it's drawn -- a blank filled in, a date
 * picked? Not on a slide, which the deck keeps shut, nor on an exported
 * page, which has no script to do it with.
 */
export const workable = (env) => !env.exported && !env.deck;

/**
 * A blank's attributes, so it can be reached by the keyboard and is read as
 * a box named `label`: the preview opens it for typing when it's focused.
 * Where it can't be filled in, it's only read, as its label and its value.
 */
export function typable(label, env) {
  return workable(env) ? ` tabindex="0" role="textbox" aria-label="${escapeAttr(label)}"` : '';
}

/**
 * Where a blank can't be filled in, an empty one says so to a screen reader
 * ("Thoughts: blank"), unseen. Kept out of the blank itself, which is
 * drawn by whether it's empty.
 */
export function unfilled(value, env) {
  return value || workable(env) ? '' : '<span class="field-blank">blank</span>';
}
