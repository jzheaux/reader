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
 *
 * A value that's all `( )` and `(x)` choices is one to pick instead, its
 * radio buttons in a row:
 *
 *   @ Session: ( ) Sat AM (x) Sat PM ( ) Sun AM
 *
 * Each button carries the line as it reads with only it picked.
 *
 * A blank can also sit inside a sentence, as in a madlib: `[@ ` and what
 * goes there, which is shown small under the blank, and the answer after a
 * colon once it's filled in:
 *
 *   I am from a [@ an ordinary item from childhood: quilt] and [@ a place].
 *
 * A line can have several, so each carries where it starts and ends on its
 * line too. One followed by `(` or `[` is a link's text, and one in `code`
 * or after a backslash is left as typed.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeExtract, readLines, placeholder, MARKS, splitText, escapeHtml, escapeAttr } from '../source.js';
import { typable, unfilled } from '../blank.js';

const FIELD = /^@[ \t]+([^:\n]*?[^:\s])[ \t]*(:+)[ \t]*(.*?)[ \t]*$/;
const HEAD = /^@[ \t]+[^:\n]*?[^:\s][ \t]*:+/;
const [OPEN, CLOSE] = MARKS.fields;
const PLACED = new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g');
const MARK = /\(([ xX])\)/g;
const INLINE = /\[@[ \t]+([^\]:\n]*?[^\]:\s])[ \t]*(?::[ \t]*([^\]\n]*?))?[ \t]*\](?![([])/g;
const CODE = /(`+)[\s\S]*?[^`]\1(?!`)|(`+)\2(?!`)/g;

/** The inline fields in `line`, outside its code spans: `[{ start, end, label, value }]`. */
function inlineFields(line) {
  if (!line.includes('[@')) return [];
  const code = [...line.matchAll(CODE)].map((m) => [m.index, m.index + m[0].length]);
  const found = [];
  for (const m of line.matchAll(INLINE)) {
    const start = m.index;
    if (line[start - 1] === '\\' || code.some(([a, b]) => start >= a && start < b)) continue;
    found.push({ start, end: start + m[0].length, label: m[1], value: m[2] ?? '' });
  }
  return found;
}

/**
 * The choices in `value`, if that's all it is: `[{ label, checked, on }]`,
 * `on` being `line` as it reads with only that one picked.
 */
function choices(line, head, value) {
  if (!value.startsWith('(')) return null;
  const parts = value.split(MARK);
  const found = [];
  for (let i = 1; i < parts.length; i += 2) {
    const label = parts[i + 1].trim();
    if (!label) return null;
    found.push({ label, checked: parts[i] !== ' ' });
  }
  if (parts[0] !== '' || !found.length) return null;
  const rest = line.slice(head.length);
  return found.map((c, k) => {
    let at = 0;
    return { ...c, on: head + rest.replace(MARK, () => (at++ === k ? '(x)' : '( )')) };
  });
}

export function fields(md) {
  beforeExtract(md, 'field_lines', (state) => {
    const found = [];
    readLines(state, (line, n) => {
      if (!FIELD.test(line)) {
        // Back to front, so each one's place on the line is still as written.
        return inlineFields(line).reduceRight((out, f) => {
          found.push({ ...f, line: n, text: line, inline: true });
          return out.slice(0, f.start) + placeholder(OPEN, CLOSE, found.length - 1) + out.slice(f.end);
        }, line);
      }
      return line.replace(FIELD, (m, label, colons, value) => {
        found.push({ line: n, text: line, head: HEAD.exec(line)[0], label, value, lines: colons.length });
        return placeholder(OPEN, CLOSE, found.length - 1);
      });
    });
    if (found.length) state.env.fields = found;
  });

  md.core.ruler.push('field_tokens', (state) => {
    const found = state.env.fields;
    if (!found) return;
    splitText(state, PLACED, (k) => {
      if (!found[k]) return null;
      const t = new state.Token(found[k].inline ? 'field_inline' : 'field', 'span', 0);
      t.meta = found[k];
      return t;
    });
    // One field to a line: the line break after one is the field's own.
    for (const block of state.tokens) {
      if (block.type !== 'inline') continue;
      block.children = block.children.filter((c, i, all) => !(c.type === 'softbreak' && all[i - 1]?.type === 'field'));
    }
  });

  md.renderer.rules.field = (tokens, i, opts, env) => {
    const { line, text, head, label, value, lines } = tokens[i].meta;
    const open = `<span class="field" data-line="${line}" data-text="${escapeAttr(text)}" data-head="${escapeAttr(head)}"`;
    const picks = choices(text, head, value);
    if (picks) {
      // Its buttons a group, named by its label.
      return `${open} data-choices role="radiogroup" aria-labelledby="field-${line}"><span class="field-label" id="field-${line}">${escapeHtml(label)}</span><span class="field-choices">`
        + picks.map((c) => `<label class="field-choice"><input type="radio" class="choice-box" name="field-${line}"`
          + ` data-on="${escapeAttr(c.on)}"${c.checked ? ' checked' : ''}> ${escapeHtml(c.label)}</label>`).join('')
        + '</span></span>';
    }
    const v = escapeHtml(value);
    const tall = lines > 1 ? ` data-lines="${lines}" style="--lines: ${lines}"` : '';
    return `${open}${tall}>`
      + `<span class="field-label">${escapeHtml(label)}</span>`
      + `<span class="field-value" data-value="${v}"${typable(label, env)}>${v}</span>${unfilled(value, env)}</span>`;
  };

  // The blank first, so the sentence lines up with what's written on it.
  md.renderer.rules.field_inline = (tokens, i, opts, env) => {
    const { line, text, start, end, label, value } = tokens[i].meta;
    const v = escapeHtml(value);
    return `<span class="field field-inline" data-line="${line}" data-text="${escapeAttr(text)}"`
      + ` data-head="${escapeAttr(`[@ ${label}`)}" data-start="${start}" data-end="${end}">`
      + `<span class="field-value" data-value="${v}"${typable(label, env)}>${v}</span>`
      + `<span class="field-label">${escapeHtml(label)}</span>${unfilled(value, env)}</span>`;
  };
}

export default {
  name: 'fields',
  plugin: fields,
  css: fs.readFileSync(new URL('./fields.css', import.meta.url), 'utf8'),
  // Drawn into the preview frame, to make it clickable.
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
  // Reads the file as written, before the features that don't.
  raw: true,
};
