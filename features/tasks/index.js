/**
 * `- [ ]` and `- [x]` at the head of a list item are a checkbox; `- ( )` and
 * `- (x)` a radio button, one choice to a list. They work wherever a list
 * does: in a quote, in an aside.
 *
 * Each box carries its line, and that line as it reads checked and
 * unchecked, so the preview can rewrite it when the box is clicked. A box
 * that doesn't head a list item (say, in an indented code block) stays as
 * typed.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAsides, readLines, placeholder, splitText, escapeAttr } from '../source.js';

const TASK = /^([ \t]*(?:[>~][ \t]*)*(?:[-*+]|\d{1,9}[.)])[ \t]+)(?:\[([ xX])\]|\(([ xX])\))(?=[ \t]|$)/;
const OPEN = '\uE000';
const CLOSE = '\uE001';
const PLACED = new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g');
const AT_HEAD = new RegExp(`^${OPEN}(\\d+)${CLOSE}[ \\t]?`);

export function tasks(md) {
  beforeAsides(md, 'task_lines', (state) => {
    const boxes = [];
    readLines(state, (line, n) => line.replace(TASK, (m, lead, box, radio) => {
      const radioButton = box === undefined;
      const mark = radioButton ? radio : box;
      const checked = mark !== ' ';
      const as = (on) => (checked && on ? line : line.replace(TASK, (t, l, b) => `${l}${b ? '[' : '('}${on ? 'x' : ' '}${b ? ']' : ')'}`));
      boxes.push({ line: n, radio: radioButton, mark, checked, on: as(true), off: as(false) });
      return `${lead}${placeholder(OPEN, CLOSE, boxes.length - 1)}`;
    }));
    // Shared with the asides' own parses, which count lists on from here.
    if (boxes.length) state.env.tasks = { boxes, lists: 0 };
  });

  md.core.ruler.push('task_tokens', (state) => {
    const tasks = state.env.tasks;
    if (!tasks) return;
    const tokens = state.tokens;
    const lists = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') lists.push(++tasks.lists);
      else if (t.type === 'bullet_list_close' || t.type === 'ordered_list_close') lists.pop();
      else if (t.type === 'list_item_open') {
        const inline = tokens[i + 1]?.type === 'paragraph_open' ? tokens[i + 2] : tokens[i + 1];
        const first = inline?.type === 'inline' ? inline.children?.[0] : null;
        const m = first?.type === 'text' && AT_HEAD.exec(first.content);
        const box = m && tasks.boxes[Number(m[1])];
        if (!box) continue;
        t.attrSet('class', ['task', t.attrGet('class')].filter(Boolean).join(' '));
        first.content = first.content.slice(m[0].length);
        const input = new state.Token('task_box', 'input', 0);
        input.meta = { ...box, group: lists.at(-1) };
        inline.children.unshift(input);
      }
    }
    // Anywhere else, a box goes back to what was typed.
    const typed = (k) => {
      const box = tasks.boxes[k];
      return box.radio ? `(${box.mark})` : `[${box.mark}]`;
    };
    splitText(state, PLACED, (k) => {
      if (!tasks.boxes[k]) return null;
      const t = new state.Token('text', '', 0);
      t.content = typed(k);
      return t;
    });
    for (const t of tokens) {
      if (t.type === 'code_block' || t.type === 'fence') t.content = t.content.replace(PLACED, (m, k) => typed(Number(k)));
    }
  });

  md.renderer.rules.task_box = (tokens, i) => {
    const { line, radio, checked, on, off, group } = tokens[i].meta;
    const lines = ` data-on="${escapeAttr(on)}" data-off="${escapeAttr(off)}"${checked ? ' checked' : ''}`;
    return radio
      ? `<input type="radio" class="choice-box" name="choice-${group}" data-line="${line}"${lines}> `
      : `<input type="checkbox" class="task-box" data-line="${line}"${lines}> `;
  };
}

export default {
  name: 'tasks',
  plugin: tasks,
  css: fs.readFileSync(new URL('./tasks.css', import.meta.url), 'utf8'),
  // Drawn into the preview frame, to make it clickable.
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
  // Reads the file as written, before render.js's own source pass.
  raw: true,
};
