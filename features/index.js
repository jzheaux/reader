/**
 * The features the renderer is built from, in the order their markdown-it
 * plugins are applied. Each is a directory here holding what it needs:
 *
 *   { name, plugin, css }
 *
 * `plugin` is a markdown-it plugin, applied after gutter-md's own; `css` is
 * added to the rendered page's stylesheet.
 */

import qa from './qa/index.js';

export const FEATURES = [qa];
