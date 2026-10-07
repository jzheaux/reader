/**
 * Helpers for features that read the source as written.
 *
 * Some syntax has to be found in the file before anything else reads it --
 * a checkbox or a field remembers the line it was written on, and the line
 * as written, to be edited later -- even when it ends up in an aside, which
 * is parsed apart from the rest. Such a feature reads each line first
 * (`readLines`, as a core rule before the asides feature's `aside_extract`), keeps
 * what it found on `env`, and leaves a placeholder in the text: a number
 * between two private-use characters, which markdown passes through
 * untouched. Once the text is parsed, it turns its placeholders into tokens
 * (`splitText`).
 */

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

/**
 * Adds `rule` to read the source before the asides come out, or after
 * normalizing it when the asides feature isn't in use.
 */
export function beforeAsides(md, name, rule) {
  try {
    md.core.ruler.before('aside_extract', name, rule);
  } catch {
    md.core.ruler.after('normalize', name, rule);
  }
}

/**
 * Runs `fn(line, n, lines, i)` over each line of the source outside fenced
 * code, and puts back what it returns; `lines` are the source's lines as
 * they were, `i` this one's index among them. Skipped for an aside's own parse (its lines
 * were read with the rest) and for inline rendering. The line numbers count
 * from `env.lineBase`, the line of the file the text starts on.
 */
export function readLines(state, fn) {
  if (state.inlineMode || state.env.__aside) return;
  const base = state.env.lineBase ?? 0;
  let fence = null;
  const lines = state.src.split('\n');
  state.src = lines.map((line, n) => {
    const f = FENCE.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      return line;
    }
    if (f) {
      fence = f[1];
      return line;
    }
    return fn(line, base + n, lines, n);
  }).join('\n');
}

/** The placeholder for item `k`, between `open` and `close`. */
export const placeholder = (open, close, k) => `${open}${k}${close}`;

/**
 * Splits each text child of each inline token at the placeholders `pattern`
 * finds (a global regex whose first group is the number), putting
 * `make(k, state)` in their place: a token, or null to leave the text.
 */
export function splitText(state, pattern, make) {
  for (const block of state.tokens) {
    if (block.type !== 'inline' || !block.children) continue;
    const out = [];
    for (const child of block.children) {
      pattern.lastIndex = 0;
      const found = child.type === 'text' && pattern.test(child.content);
      // matchAll starts from where test() left off.
      pattern.lastIndex = 0;
      if (!found) {
        out.push(child);
        continue;
      }
      let last = 0;
      for (const m of child.content.matchAll(pattern)) {
        const token = make(Number(m[1]), state);
        if (!token) continue;
        if (m.index > last) out.push(text(state, child.content.slice(last, m.index)));
        out.push(token);
        last = m.index + m[0].length;
      }
      if (last < child.content.length) out.push(text(state, child.content.slice(last)));
    }
    block.children = out;
  }
}

function text(state, content) {
  const t = new state.Token('text', '', 0);
  t.content = content;
  return t;
}

/** `&`, `<`, `>` and `"` escaped, for text. */
export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** `&`, `"` and `<` escaped, for an attribute's value. */
export const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Adds `name` to a token's classes, after any it has; a token that had none
 * gets its class attribute first, as markdown writes it.
 */
export function addClass(token, name) {
  const had = token.attrGet('class');
  if (had) token.attrSet('class', `${had} ${name}`);
  else token.attrs = [['class', name], ...(token.attrs || [])];
}
