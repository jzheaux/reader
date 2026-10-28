/**
 * Steps to follow: a `1)` list whose items have boxes, each badge a box
 * of its own to mark the step done.
 *
 *   1) [x] Heat the oil in a large pot.
 *   2) [ ] Add the onion and cook until soft.
 *
 * The first step not done is the current one, lit up once any is done;
 * clicking a step lights it instead (preview.js). The steps of a section
 * -- the heading they're under, lists cut by a callout or a quote among
 * them -- go together, so a step's group is its section's line
 * (`data-steps`).
 *
 * It's built on tasks, whose boxes it reads in the tokens, and on badges,
 * whose badge each step's box sits over (steps.css), so it requires both.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sections, addClass } from '../source.js';

export function steps(md) {
  md.core.ruler.push('steps', (state) => {
    if (state.inlineMode) return;
    let of = null;
    const lists = [];
    state.tokens.forEach((t, i) => {
      if (t.type === 'ordered_list_open' || t.type === 'bullet_list_open') lists.push(t.type === 'ordered_list_open' && t.markup === ')');
      else if (t.type === 'ordered_list_close' || t.type === 'bullet_list_close') lists.pop();
      else if (t.type === 'list_item_open' && lists.at(-1)) {
        const inline = state.tokens[i + 1]?.type === 'paragraph_open' ? state.tokens[i + 2] : state.tokens[i + 1];
        const box = inline?.type === 'inline' && inline.children?.[0];
        if (box?.type !== 'task_box' || box.meta.radio || box.meta.staged) return;
        of ??= sections(state).of;
        addClass(t, box.meta.checked ? 'step step-done' : 'step');
        box.meta.step = true;
        t.attrSet('data-steps', String(of[i].line));
      }
    });
  });
}

export default {
  name: 'steps',
  requires: ['tasks', 'badges'],
  plugin: steps,
  css: fs.readFileSync(new URL('./steps.css', import.meta.url), 'utf8'),
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
};
