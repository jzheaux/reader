/**
 * A line starting `@ ` is a form field: a label, a colon, and whatever's
 * filled in after it, which can be nothing yet. Each colon is a line of
 * blank, so `@ Notes:::` gets three.
 *
 *   @ My Name: Josh
 *   @ Date:
 *
 * The field carries its line, the line as written and its head (up to the
 * colons), so the preview can open the blank for typing and write the new
 * value back after the head. The value is shown as typed, with no markdown.
 */

import fs from 'node:fs';
import { beforeAsides, readLines, placeholder, splitText, escapeHtml, escapeAttr } from '../source.js';

const FIELD = /^@[ \t]+([^:\n]*?[^:\s])[ \t]*(:+)[ \t]*(.*?)[ \t]*$/;
const HEAD = /^@[ \t]+[^:\n]*?[^:\s][ \t]*:+/;
const OPEN = '\uE010';
const CLOSE = '\uE012';
const PLACED = new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g');

export function fields(md) {
  beforeAsides(md, 'field_lines', (state) => {
    const found = [];
    readLines(state, (line, n) => line.replace(FIELD, (m, label, colons, value) => {
      found.push({ line: n, text: line, head: HEAD.exec(line)[0], label, value, lines: colons.length });
      return placeholder(OPEN, CLOSE, found.length - 1);
    }));
    if (found.length) state.env.fields = found;
  });

  md.core.ruler.push('field_tokens', (state) => {
    const found = state.env.fields;
    if (!found) return;
    splitText(state, PLACED, (k) => {
      if (!found[k]) return null;
      const t = new state.Token('field', 'span', 0);
      t.meta = found[k];
      return t;
    });
    // One field to a line: the line break after one is the field's own.
    for (const block of state.tokens) {
      if (block.type !== 'inline') continue;
      block.children = block.children.filter((c, i, all) => !(c.type === 'softbreak' && all[i - 1]?.type === 'field'));
    }
  });

  md.renderer.rules.field = (tokens, i) => {
    const { line, text, head, label, value, lines } = tokens[i].meta;
    const v = escapeHtml(value);
    const tall = lines > 1 ? ` data-lines="${lines}" style="--lines: ${lines}"` : '';
    return `<span class="field" data-line="${line}" data-text="${escapeAttr(text)}" data-head="${escapeAttr(head)}"${tall}>`
      + `<span class="field-label">${escapeHtml(label)}</span>`
      + `<span class="field-value" data-value="${v}">${v}</span></span>`;
  };
}

export default {
  name: 'fields',
  plugin: fields,
  css: fs.readFileSync(new URL('./fields.css', import.meta.url), 'utf8'),
  // Reads the file as written, before render.js's own source pass.
  raw: true,
};
