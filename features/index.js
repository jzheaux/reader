/**
 * The features the renderer is built from, in the order their markdown-it
 * plugins are applied. Each is a directory here holding what it needs:
 *
 *   { name, requires?, plugin?, html?, css?, raw?, late?, preview?, lazy? }
 *
 * - `requires`: the names of the features this one is built on, whose
 *   tokens, classes or events it reads, as steps reads tasks' boxes and
 *   draws on badges' badges. It still imports nothing from them. Each must
 *   be in the list, and come before it, or loading the list fails.
 * - `plugin`: a markdown-it plugin.
 * - `html`: a pass over the finished page's HTML, for what the tokens don't
 *   reach (the masthead, say).
 * - `css`: added to the rendered page's stylesheet.
 * - `raw`: applied before the rest: a feature that reads the file as
 *   written, or asides, whose rule the others place theirs by.
 * - `late`: a markdown-it plugin applied after every feature's `plugin`,
 *   for a rule that reads what all of them leave as text: the words an
 *   aside chooses.
 * - `preview`: the path of a script the server loads into the preview frame,
 *   where it can use static/preview-api.js, or a list of them, loaded in
 *   order.
 * - `lazy`: the path of a script, or a list of them, served for the preview
 *   frame to load itself, when a page needs it: a big one, say, that most
 *   pages don't.
 */

import asides from './asides/index.js';
import fields from './fields/index.js';
import tasks from './tasks/index.js';
import qa from './qa/index.js';
import definitions from './definitions/index.js';
import sizes from './sizes/index.js';
import alerts from './alerts/index.js';
import attributions from './attributions/index.js';
import styles from './styles/index.js';
import date from './date/index.js';
import scripture from './scripture/index.js';
import scriptureLds from './scripture-lds/index.js';
import search from './search/index.js';
import rfc from './rfc/index.js';
import count from './count/index.js';
import social from './social/index.js';
import arrows from './arrows/index.js';
import math from './math/index.js';
import emoji from './emoji/index.js';
import puzzles from './puzzles/index.js';
import highlight from './highlight/index.js';
import mermaid from './mermaid/index.js';
import headline from './headline/index.js';
import number from './number/index.js';
import badges from './badges/index.js';
import steps from './steps/index.js';
import ingredients from './ingredients/index.js';
import columns from './columns/index.js';
import tabs from './tabs/index.js';

// styles comes after qa and attributions: a `:::` block marks a line after
// qa has made it a list item, and after an attribution's dash is marked, as
// it does any other. highlight comes before puzzles, which wraps the fence
// rule it finds, as mermaid, headline and number do. columns comes after
// styles, which leaves it the lines its blocks open and close on. date comes after fields and tasks, so the lines
// they keep are as written, without its marks. tabs comes last, so the
// words it compares are the ones the others leave as text; only the `late`
// plugins, which find the words an aside chooses, come after it.
export const FEATURES = checkRequires([asides, fields, tasks, qa, definitions, sizes, alerts, attributions, styles, columns, date, scripture, scriptureLds, search, rfc, count, social, math, arrows, emoji, highlight, mermaid, headline, number, badges, steps, ingredients, puzzles, tabs]);

/**
 * Throws unless each feature's `requires` names features in the list that
 * come before it, in the order their plugins are applied: those that are
 * `raw` first, then the rest, then those with only a `late` plugin, as
 * src/render.js applies them. A feature with a `plugin` and a `late` one
 * goes by its `plugin`, where its rules start. A feature's rules can then
 * rely on what the ones it requires leave in the tokens. Returns the list.
 */
export function checkRequires(features) {
  const lateOnly = (f) => f.late && !f.plugin;
  const order = [
    ...features.filter((f) => f.raw),
    ...features.filter((f) => !f.raw && !lateOnly(f)),
    ...features.filter((f) => !f.raw && lateOnly(f)),
  ].map((f) => f.name);
  for (const f of features) {
    for (const name of f.requires ?? []) {
      const at = order.indexOf(name);
      if (at < 0) throw new Error(`The ${f.name} feature requires ${name}, which isn't in the list of features`);
      if (at > order.indexOf(f.name)) throw new Error(`The ${f.name} feature requires ${name}, which has to come before it in the list of features`);
    }
  }
  return features;
}
