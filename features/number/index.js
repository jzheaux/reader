/**
 * A ```number fence is a figure worth a box of its own: the number, big,
 * and a line under it saying what it counts.
 *
 *   ```number
 *   15%
 *   daily code change
 *   ```
 *
 * The first line is the number and the rest is the line under it; both are
 * prose, so a span colors one (`[15%]{seagreen}`) and emphasis shows. A long
 * number is set smaller, to stay on its line.
 */

import fs from 'node:fs';
import MarkdownIt from 'markdown-it';
import { addClass } from '../source.js';

const { Token } = MarkdownIt;

/** A fence's text -> `{ figure, caption }`, each a string, `''` when not given. */
export function readNumber(text) {
  const [figure = '', ...rest] = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return { figure, caption: rest.join(' ') };
}

export function numbers(md) {
  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, i, opts, env, self) => {
    const token = tokens[i];
    if (token.info.trim().split(/\s+/)[0] !== 'number') return fence(tokens, i, opts, env, self);
    const n = readNumber(token.content);
    if (!n.figure) return fence(tokens, i, opts, env, self);
    const inline = (text) => md.renderInline(text, { lineBase: 0, shared: {} });
    const figure = inline(n.figure);
    // How many characters it shows as, for the stylesheet to size it by.
    const chars = [...figure.replace(/<[^>]*>/g, '').replace(/&\w+;/g, '.')].length;

    const wrapper = Object.assign(new Token('div', 'div', 1), { attrs: token.attrs?.map((a) => [...a]) ?? null });
    addClass(wrapper, 'number');
    return [
      `<div${self.renderAttrs(wrapper)}>`,
      `<p class="number-figure" style="--chars: ${chars}">${figure}</p>`,
      n.caption && `<p class="number-caption">${inline(n.caption)}</p>`,
      '</div>',
    ].filter(Boolean).join('\n') + '\n';
  };
}

export default {
  name: 'number',
  plugin: numbers,
  css: fs.readFileSync(new URL('./number.css', import.meta.url), 'utf8'),
};
