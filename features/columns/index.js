/**
 * Blocks side by side: a `:::` block named `columns`, each block in it a
 * column, all the same width:
 *
 *   ::: columns
 *   ```number
 *   15%
 *   daily code change
 *   ```
 *
 *   ```number
 *   26%
 *   weekly code change
 *   ```
 *   :::
 *
 * A column of more than one block is written between `+++` lines, which
 * then are the only things that start a column:
 *
 *   ::: columns
 *   ### Before
 *   * slow
 *   +++
 *   ### After
 *   * fast
 *   :::
 *
 * The other names on the fence are styles for what's in it, as on any `:::`
 * block (`::: columns avenir-next`), and blocks nest, columns in a column
 * too. The styles feature reads the fences, leaving this block's as the
 * marks in features/layout.js, which splits what's between them.
 */

import fs from 'node:fs';
import { opens, panes } from '../layout.js';

export function columns(md) {
  md.block.ruler.before('fence', 'columns', rule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
}

function rule(state, startLine, endLine, silent) {
  if (!opens(state, startLine, 'columns')) return false;
  if (silent) return true;

  const open = state.push('columns_open', 'div', 1);
  open.attrs = [['class', 'columns']];
  open.block = true;
  // An aside written in it or after it is about all of it (features/rows.js).
  open.meta = { whole: true };

  const { end, panes: columns } = panes(state, startLine, endLine, 'columns');
  open.map = [startLine, Math.min(end + 1, endLine)];
  for (const { tokens, map } of columns) {
    const column = state.push('column_open', 'div', 1);
    column.attrs = [['class', 'column']];
    column.block = true;
    column.map = map;
    state.tokens.push(...tokens);
    state.push('column_close', 'div', -1).block = true;
  }

  state.push('columns_close', 'div', -1).block = true;
  state.line = Math.min(end + 1, endLine);
  return true;
}

export default {
  name: 'columns',
  plugin: columns,
  css: fs.readFileSync(new URL('./columns.css', import.meta.url), 'utf8'),
};
