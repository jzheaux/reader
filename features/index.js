/**
 * The features the renderer is built from, in the order their markdown-it
 * plugins are applied. Each is a directory here holding what it needs:
 *
 *   { name, plugin, css, raw? }
 *
 * `plugin` is a markdown-it plugin, applied after gutter-md's own; `css` is
 * added to the rendered page's stylesheet. A `raw` feature reads the file as
 * written, so it is applied before render.js's own source pass (which still
 * holds the syntax not yet made into features); the rest come after it.
 */

import fields from './fields/index.js';
import tasks from './tasks/index.js';
import qa from './qa/index.js';

export const FEATURES = [fields, tasks, qa];
