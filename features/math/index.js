/**
 * `math:[…]` sets relations between ideas as symbols, keeping the words
 * upright: `>=` as ≥, `>>` as ≫, `->` as →, `*` as ×, `.:` as ∴ and so on.
 * Alone on its line it is centered like an equation; within a sentence it
 * stays inline.
 *
 *   math:[recognition >> judgment]
 */

import fs from 'node:fs';
import { schemeRule } from '../scheme.js';
import { addClass } from '../source.js';

// Longest first, so `<->` isn't read as `<-` and `>`.
const OPERATORS = [
  ['<->', '\u2194'], ['->', '\u2192'], ['<-', '\u2190'], ['>=', '\u2265'], ['<=', '\u2264'],
  ['!=', '\u2260'], ['~=', '\u2248'], ['>>', '\u226B'], ['<<', '\u226A'], ['+-', '\u00B1'],
  ['.:', '\u2234'], ['*', '\u00D7'], ['>', '>'], ['<', '<'], ['=', '='], ['+', '+'],
];
const OPERATOR = new RegExp(
  `\\s*(${OPERATORS.map(([op]) => op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*`,
  'g',
);
const SYMBOL = new Map(OPERATORS);

/**
 * The inside of `math:[…]`: operators become their symbols, spaced as a
 * relation is, with a no-break space before so a line never starts with one.
 * A `-` becomes a minus unless it joins two words, and `inf` becomes ∞.
 */
export function math(expr) {
  return expr
    .replace(OPERATOR, (m, op) => `\u00A0${SYMBOL.get(op)} `)
    .replace(/(?<!\w)-|-(?!\w)/g, '\u2212')
    .replace(/\binf\b/g, '\u221E')
    .trim();
}

export function maths(md) {
  schemeRule(md, {
    name: 'math',
    scheme: 'math',
    path: /(?:)/,
    make: (state, where, expr, { start, end }) => {
      if (!state) return true;
      // Alone on its line: nothing else on it, before or after.
      const from = state.src.lastIndexOf('\n', start - 1) + 1;
      const to = state.src.indexOf('\n', end);
      const alone = !state.src.slice(from, start).trim() && !state.src.slice(end, to < 0 ? undefined : to).trim();
      const open = state.push('math_open', 'span', 1);
      open.attrSet('class', 'math');
      open.meta = { alone };
      state.push('text', '', 0).content = math(expr);
      state.push('math_close', 'span', -1);
      return true;
    },
  });

  // A paragraph that opens with an expression alone on its line is
  // displayed, centered. After a `:::` block's style, so its class follows.
  md.core.ruler.push('math_display', (state) => {
    const tokens = state.tokens;
    for (let i = 1; i < tokens.length; i++) {
      const first = tokens[i].type === 'inline' && tokens[i].children?.[0];
      if (first?.type === 'math_open' && first.meta?.alone && tokens[i - 1].type === 'paragraph_open') {
        addClass(tokens[i - 1], 'math-display');
      }
    }
  });
}

export default {
  name: 'math',
  plugin: maths,
  css: fs.readFileSync(new URL('./math.css', import.meta.url), 'utf8'),
};
