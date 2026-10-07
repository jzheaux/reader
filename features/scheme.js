/**
 * Links written `scheme:path[label]` -- `scripture:[Isaiah 2:1-5]`,
 * `search:[commensality]` -- as an inline rule.
 *
 * Like markdown-it's own linkify, the rule looks at each `:`, and checks
 * that the scheme was written just before it, as a word of its own (not
 * after a letter, a digit or a backslash). Code is never seen, so is never
 * linked. What follows the colon is a path, which may be empty, then a
 * label in brackets; `link(path, label)` makes them a link, or returns null
 * to leave the text as typed.
 *
 *   schemeLinks(md, {
 *     name: 'scripture',
 *     scheme: 'scripture',
 *     path: /[\w/.:-]* /,
 *     link: (path, label) => ({ href, label, attrs? }) | null,
 *   })
 *
 * The label is markdown, as in any link. `attrs` are more attributes for the
 * link, ahead of its `href`.
 */

const BEFORE = /[\w\\]/;

export function schemeLinks(md, { name, scheme, path, link }) {
  const after = new RegExp(`^(${path.source})\\[([^\\]\\n]*)\\]`);
  md.inline.ruler.before('linkify', name, (state, silent) => {
    const colon = state.pos;
    if (state.src.charCodeAt(colon) !== 0x3A /* : */) return false;
    const start = colon - scheme.length;
    if (start < 0 || state.src.slice(start, colon) !== scheme) return false;
    if (start > 0 && BEFORE.test(state.src[start - 1])) return false;
    if (!state.pending.endsWith(scheme)) return false;
    const m = after.exec(state.src.slice(colon + 1, state.posMax));
    const found = m && link(m[1], m[2]);
    if (!found) return false;
    if (!silent) {
      state.pending = state.pending.slice(0, -scheme.length);
      const open = state.push('link_open', 'a', 1);
      open.attrs = [...(found.attrs || []), ['href', state.md.normalizeLink(found.href)]];
      // The label is markdown, its brackets and backslashes as typed.
      const label = [];
      state.md.inline.parse(found.label.replace(/[[\]\\]/g, '\\$&'), state.md, state.env, label);
      // Nested in the link, as a link's own label would be. markdown-it keeps
      // a note on each token, in step with them, to pair up emphasis.
      for (const t of label) t.level += state.level;
      state.tokens.push(...label);
      state.tokens_meta.push(...label.map(() => null));
      state.push('link_close', 'a', -1);
    }
    state.pos = colon + 1 + m[0].length;
    return true;
  });
}
