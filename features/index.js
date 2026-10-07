/**
 * The features the renderer is built from, in the order their markdown-it
 * plugins are applied. Each is a directory here holding what it needs:
 *
 *   { name, plugin?, html?, css?, raw?, preview? }
 *
 * `plugin` is a markdown-it plugin, applied after gutter-md's own; `html`, a
 * pass over the finished page's HTML, for what the tokens don't reach (the
 * masthead, say); `css`, if any, is added to the rendered page's stylesheet; `preview`, if any, is the path of
 * a script the server loads into the preview frame, where it can use
 * static/preview-api.js. A `raw` feature reads the file as
 * written, so it is applied before render.js's own source pass (which still
 * holds the syntax not yet made into features); the rest come after it.
 */

import fields from './fields/index.js';
import tasks from './tasks/index.js';
import qa from './qa/index.js';
import sizes from './sizes/index.js';
import styles from './styles/index.js';
import scripture from './scripture/index.js';
import scriptureLds from './scripture-lds/index.js';
import search from './search/index.js';
import arrows from './arrows/index.js';
import emoji from './emoji/index.js';

// styles comes after qa: a `:::` block marks a line after qa has made it a
// list item, as it does any other.
export const FEATURES = [fields, tasks, qa, sizes, styles, scripture, scriptureLds, search, arrows, emoji];
