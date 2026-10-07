/**
 * Code fences highlighted by language, on the server, so the preview frame
 * runs nothing for it. A language highlight.js doesn't know, or none, is
 * left plain.
 *
 * Braces after the language pick out lines, counted from 1 in the fence:
 *
 *   ```js {3,5-7}         lines 3 and 5 to 7 stand out; the rest fade
 *   ```js {numbers}       each line numbered
 *   ```js {1-3|5|7-9}     on a slide, 1-3 stand out, then 5 with the next
 *                         step, then 7-9 with the one after
 *
 * `numbers` goes with either, in any order: `{numbers 3,5-7}`. Once lines
 * are picked out, each is a `.line` of its own, holding the tags of what
 * it's in, so a comment that runs across lines is closed at each end and
 * opened again on the next. A fence with ranges separated by `|` says how
 * many steps it takes (`data-focus-steps`), and each of its lines which of
 * them it stands out in (`data-focus`); the first shows from the start, and
 * when presenting, the deck moves through the rest.
 */

import fs from 'node:fs';
import hljs from 'highlight.js';
import { escapeHtml, escapeAttr } from '../source.js';

const INFO = /^([^\s{]*)\s*(?:\{([^}]*)\})?\s*$/;
const RANGES = /^\d+(?:-\d+)?(?:[,|]\d+(?:-\d+)?)*$/;
const TAG = /(<span[^>]*>|<\/span>|\n)/;

/**
 * A fence's info string -> `{ lang, numbers, groups }`: each group a set
 * of lines to stand out together. Braces it can't read leave the info as
 * typed, with no lines picked out.
 */
export function parseInfo(info) {
  const m = INFO.exec(info.trim());
  if (!m) return { lang: info.trim().split(/\s+/)[0] || '', numbers: false, groups: [] };
  let numbers = false;
  let groups = [];
  for (const word of (m[2] || '').split(/\s+/).filter(Boolean)) {
    if (word === 'numbers') numbers = true;
    else if (RANGES.test(word)) groups = word.split('|').map(lines);
    else return { lang: m[1], numbers: false, groups: [] };
  }
  return { lang: m[1], numbers, groups };
}

/** `3,5-7` -> the set {3, 5, 6, 7}. */
function lines(ranges) {
  const out = new Set();
  for (const r of ranges.split(',')) {
    const [from, to = from] = r.split('-').map(Number);
    for (let n = from; n <= to; n++) out.add(n);
  }
  return out;
}

/** `code` as highlighted HTML, or escaped, if `lang` isn't one known. */
export function highlight(code, lang) {
  if (!lang || !hljs.getLanguage(lang)) return escapeHtml(code);
  return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
}

/**
 * Highlighted HTML cut at its line breaks, each line closing the spans
 * still open at its end and the next opening them again.
 */
export function splitLines(html) {
  const out = [];
  const open = [];
  let line = '';
  for (const part of html.split(TAG)) {
    if (part === '\n') {
      out.push(line + '</span>'.repeat(open.length));
      line = open.join('');
    } else {
      if (part.startsWith('<span')) open.push(part);
      else if (part === '</span>') open.pop();
      line += part;
    }
  }
  out.push(line + '</span>'.repeat(open.length));
  return out;
}

export function highlighting(md) {
  md.renderer.rules.fence = (tokens, i, opts, env, self) => {
    const token = tokens[i];
    const info = token.info ? md.utils.unescapeAll(token.info) : '';
    const { lang, numbers, groups } = parseInfo(info);
    const known = Boolean(lang && hljs.getLanguage(lang));
    const code = known ? ` class="hljs language-${escapeAttr(lang)}"` : (lang ? ` class="language-${escapeAttr(lang)}"` : '');
    const html = highlight(token.content, lang);
    if (!numbers && !groups.length) return `<pre${self.renderAttrs(token)}><code${code}>${html}</code></pre>\n`;

    const rows = splitLines(html.replace(/\n$/, ''));
    const classes = ['code-lines', numbers && 'code-numbers', groups.length && 'code-focus'].filter(Boolean);
    const attrs = [...(token.attrs || [])];
    const had = attrs.find(([k]) => k === 'class');
    if (had) had[1] = `${had[1]} ${classes.join(' ')}`;
    else attrs.unshift(['class', classes.join(' ')]);
    if (numbers) attrs.push(['style', `--digits: ${String(rows.length).length}`]);
    if (groups.length > 1) attrs.push(['data-focus-steps', String(groups.length)]);
    const pre = attrs.map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join('');

    const body = rows.map((row, k) => {
      const n = k + 1;
      const hl = groups[0]?.has(n) ? ' hl' : '';
      const focus = groups.length > 1 ? groups.flatMap((g, j) => (g.has(n) ? [j + 1] : [])) : [];
      const data = focus.length ? ` data-focus="${focus.join(' ')}"` : '';
      return `<span class="line${hl}"${data}>${row}</span>`;
    }).join('\n');
    return `<pre${pre}><code${code}>${body}\n</code></pre>\n`;
  };
}

export default {
  name: 'highlight',
  plugin: highlighting,
  css: fs.readFileSync(new URL('./highlight.css', import.meta.url), 'utf8'),
};
