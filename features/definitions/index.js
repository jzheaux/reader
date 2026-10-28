/**
 * A line starting `!` is a definition: a term, a colon, and what it means,
 * set as a dictionary sets it. The meaning is markdown like any other line,
 * and who used the term can follow it in parentheses, as in an exchange:
 *
 *   !SLAB (Venkat): similar layers of abstraction
 *
 * Definitions on lines in a row make one glossary, and the same term again
 * straight after is another sense of it, numbered. A term with nothing after
 * its colon is one heard but not yet looked up: a blank, filled in as a
 * field is (the fields feature's preview does the filling).
 *
 * A term in capitals whose meaning spells it out has those letters bolded
 * (**S**imilar **L**ayers of **AB**straction). And `!` before the term
 * elsewhere in the text -- before its definition or after, in an aside, or
 * on a later slide of a deck -- sets it as it's set in its entry, its
 * meaning shown on hover:
 *
 *   Venkat keeps coming back to !SLAB.
 *
 * `\!` keeps a line, or a term in the text, as typed, as does fenced code
 * or an aside's own `~ !` (an aside can still use a term the document
 * defines).
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAsides, readLines, MARKS, escapeHtml, escapeAttr, textToken, split, eachText, escapeRegExp, wordForms } from '../source.js';
import { typable } from '../fields/index.js';

// A term can't open with `[` (an image) and holds no colon or parentheses.
// A name may hold a link, whose address is in parentheses of its own.
const DEF = /^\\?![ \t]*([^\s[!:()][^:()\n]*?)[ \t]*(?:\(((?:[^()\n]|\([^()\n]*\))*)\)[ \t]*)?:(?:[ \t]+(.*?))?[ \t]*$/;
const [OPEN, CLOSE] = MARKS.definitions;
// A `:::` block's marker (features/styles) may come before the placeholder.
const STYLED = `${MARKS.styles[0]}[^${MARKS.styles[1]}]*${MARKS.styles[1]}`;
const PLACED = new RegExp(`^(${STYLED})?${OPEN}(\\d+)${CLOSE}`);

// Words an acronym skips, unless it needs their letter.
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with']);
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’]*/gu;

export function definitions(md) {
  beforeAsides(md, 'definition_lines', lines);
  md.block.ruler.before('paragraph', 'definition', block, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.core.ruler.push('definition_initials', (state) => {
    for (const t of state.tokens) if (t.type === 'inline' && t.meta?.definition) initials(state, t, t.meta.definition.term);
  });
  // Before an escaped `\!` joins the text after it, so it can be told from
  // one that isn't.
  md.core.ruler.before('text_join', 'definition_uses', uses);

  md.renderer.rules.def_list_open = (tokens, i, opts, env, self) => `<dl${self.renderAttrs(tokens[i])}>\n`;
  md.renderer.rules.def_list_close = () => '</dl>\n';
  // With what's been added to them: a `:::` block's styles, their line.
  md.renderer.rules.def_open = (tokens, i, opts, env, self) => `<div${self.renderAttrs(tokens[i])}>\n`;
  md.renderer.rules.def_close = () => '</div>\n';
  md.renderer.rules.def_term = (tokens, i) => `<dt class="def-term">${escapeHtml(tokens[i].meta.term)}</dt>\n`;
  md.renderer.rules.def_meaning_open = () => '<dd class="def-meaning">';
  md.renderer.rules.def_meaning_close = (tokens, i) => {
    const { name } = tokens[i].meta;
    return `${name ? `<span class="def-name">${md.renderInline(name)}</span>` : ''}</dd>\n`;
  };
  md.renderer.rules.def_blank = (tokens, i, opts, env) => {
    const { line, text, head, term } = tokens[i].meta;
    // No unseen "blank" where it can't be filled in: the stylesheet's "not
    // yet defined" already says it's empty, and is read out.
    return `<span class="field def-blank" data-line="${line}" data-text="${escapeAttr(text)}" data-head="${escapeAttr(head)}">`
      + `<span class="field-value" data-value=""${typable(term, env)}></span></span>`;
  };
  md.renderer.rules.def_initial = (tokens, i) => `<b class="def-initial">${escapeHtml(tokens[i].content)}</b>`;
  md.renderer.rules.def_use = (tokens, i, options, env) => {
    const { text, term, senses } = tokens[i].meta;
    const said = senses.filter((s) => s.meaning);
    // Senses in a run, as in the entry: a list can't sit in a paragraph.
    const meaning = said.length > 1
      ? said.map((s, k) => `<b class="def-pop-sense">${k + 1}.</b> ${md.renderInline(s.meaning)}`).join(' ')
      : said.length ? md.renderInline(said[0].meaning) : '<i>not yet defined</i>';
    // The meaning is the term's description, read once on focus, rather than
    // a second time as part of its text. Counted across a deck's slides, which
    // an export puts on one page.
    const shared = env.shared ?? env;
    const id = `def-pop-${shared.defPops = (shared.defPops ?? 0) + 1}`;
    return `<span class="def-use" tabindex="0" aria-describedby="${id}">${escapeHtml(text)}`
      + `<span class="def-pop" role="tooltip" aria-hidden="true"><b class="def-pop-term">${escapeHtml(term)}</b> <span id="${id}">${meaning}</span></span></span>`;
  };
}

/**
 * Notes each definition line, by its line in the file, and leaves in its
 * place a placeholder with the meaning after it, for `block` to find.
 */
function lines(state) {
  const found = [];
  readLines(state, (line, n) => {
    const d = DEF.exec(line);
    if (!d) return line;
    if (line.startsWith('\\')) return line.slice(1);
    const [, term, name, meaning] = d;
    found.push({ line: n, text: line, head: meaning ? null : line.trimEnd(), term, name: name?.trim() ?? '', meaning: meaning ?? '' });
    return `${OPEN}${found.length - 1}${CLOSE}${meaning ? ` ${meaning}` : ''}`;
  });
  if (!found.length) return;
  state.env.definitions = found;
  // A deck's later slides know the terms its earlier ones defined.
  const shared = state.env.shared ?? (state.env.shared = {});
  const known = shared.definitions ?? (shared.definitions = new Map());
  for (const d of found) {
    const senses = known.get(d.term);
    if (senses && !senses.includes(d)) senses.push(d);
    else if (!senses) known.set(d.term, [d]);
  }
}

/** Definitions on lines in a row: a glossary, a term's senses together. */
function block(state, startLine, endLine, silent) {
  const found = state.env.definitions;
  if (!found || state.sCount[startLine] - state.blkIndent >= 4) return false;
  const at = (n) => {
    const m = PLACED.exec(state.src.slice(state.bMarks[n] + state.tShift[n], state.eMarks[n]));
    return m && found[Number(m[2])] ? { d: found[Number(m[2])], skip: m[0].length, styled: m[1] ?? '' } : null;
  };
  if (!at(startLine)) return false;
  if (silent) return true;

  let next = startLine;
  const run = [];
  while (next < endLine && state.sCount[next] === state.sCount[startLine] && at(next)) run.push({ n: next++, ...at(next - 1) });

  const open = state.push('def_list_open', 'dl', 1);
  open.map = [startLine, next];
  open.attrSet('class', 'defs');
  for (let i = 0; i < run.length;) {
    let j = i + 1;
    while (j < run.length && run[j].d.term === run[i].d.term) j++;
    const def = state.push('def_open', 'div', 1);
    def.map = [run[i].n, run[j - 1].n + 1];
    def.meta = { senses: j - i };
    def.attrSet('class', j - i > 1 ? 'def def-senses' : 'def');
    state.push('def_term', 'dt', 0).meta = { term: run[i].d.term };
    for (const { n, d, skip, styled } of run.slice(i, j)) {
      const dd = state.push('def_meaning_open', 'dd', 1);
      dd.map = [n, n + 1];
      if (d.meaning) {
        // The marker stays with the meaning, for its entry to take the styles.
        const inline = state.push('inline', '', 0);
        inline.content = styled + state.src.slice(state.bMarks[n] + state.tShift[n] + skip, state.eMarks[n]).trim();
        inline.map = [n, n + 1];
        inline.children = [];
        inline.meta = { definition: d };
      } else {
        state.push('def_blank', 'span', 0).meta = d;
      }
      state.push('def_meaning_close', 'dd', -1).meta = { name: d.name };
    }
    state.push('def_close', 'div', -1);
    i = j;
  }
  state.push('def_list_close', 'dl', -1);
  state.line = next;
  return true;
}

/**
 * Sets a defined term written with a `!` before it, outside code and
 * links, as its entry sets it.
 */
function uses(state) {
  if (state.inlineMode) return;
  const known = state.env.shared?.definitions;
  if (!known?.size) return;
  // An acronym is matched as written, or with an `s`; a word or phrase in
  // lower case, in any case, plural or singular (`!innovation tokens`).
  const written = new Map();
  for (const t of known.keys()) {
    for (const f of t === t.toLowerCase() ? wordForms(t) : [t, `${t}s`]) if (!written.has(f)) written.set(f, t);
  }
  const escaped = [...written.keys()].sort((a, b) => a.length - b.length).map(escapeRegExp);
  const find = new RegExp(`(?<![\\p{L}\\p{N}_])!(?:${escaped.join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
  const term = (text) => (known.has(text) ? text : written.get(text) ?? written.get(text.toLowerCase()));

  for (const block of state.tokens) {
    if (block.type !== 'inline' || !block.children || block.meta?.definition) continue;
    eachText(block, (child) => split(state, child, find, (m) => {
      const t = term(m[0].slice(1));
      if (!t) return null;
      const use = new state.Token('def_use', 'span', 0);
      use.meta = { text: m[0].slice(1), term: t, senses: known.get(t) };
      return use;
    }));
  }
}

/** Bolds the letters of `term`, if it's an acronym the meaning in `block` spells out. */
function initials(state, block, term) {
  if (!/^[A-Z]{2,}$/.test(term)) return;
  const words = block.children.flatMap((c, k) => (c.type === 'text' ? [...c.content.matchAll(WORD)].map((m) => ({ k, at: m.index, word: m[0] })) : []));
  const letters = [...term];
  // Each word opens with the next letter, or is a small one passed over. A
  // word may give the letters after it too: those it starts with
  // (ABstraction), or, in camel case, its capitals (JavaScript).
  const ways = (word, at, l) => {
    const prefix = [];
    for (let p = 0; p < word.length && l + p < letters.length && word[p].toUpperCase() === letters[l + p]; p++) prefix.push(at + p);
    const camel = [at];
    if (word !== word.toUpperCase()) {
      for (let p = 1; p < word.length && l + camel.length < letters.length; p++) {
        if (word[p] === letters[l + camel.length] && word[p] !== word[p].toLowerCase()) camel.push(at + p);
      }
    }
    // The fewest letters first: one a word, unless the rest can't be spelled.
    const all = [camel, ...prefix.map((_, p) => prefix.slice(0, prefix.length - p))];
    return prefix.length ? all.filter((w, i) => w.length && all.findIndex((v) => v.join() === w.join()) === i).sort((a, b) => a.length - b.length) : [];
  };
  const spell = (w, l) => {
    if (l === letters.length) return [];
    if (w === words.length) return null;
    const { k, at, word } = words[w];
    for (const taken of ways(word, at, l)) {
      const rest = spell(w + 1, l + taken.length);
      if (rest) return [...taken.map((a) => ({ k, at: a })), ...rest];
    }
    return SMALL.has(word.toLowerCase()) ? spell(w + 1, l) : null;
  };
  const marks = spell(0, 0);
  if (!marks) return;
  block.children = block.children.flatMap((c, k) => {
    const here = marks.filter((m) => m.k === k).map((m) => m.at);
    if (!here.length) return [c];
    const out = [];
    let last = 0;
    for (const at of here) {
      if (at > last) out.push(textToken(state, c.content.slice(last, at)));
      const b = new state.Token('def_initial', 'b', 0);
      b.content = c.content[at];
      out.push(b);
      last = at + 1;
    }
    if (last < c.content.length) out.push(textToken(state, c.content.slice(last)));
    return out;
  });
}

export default {
  name: 'definitions',
  plugin: definitions,
  css: fs.readFileSync(new URL('./definitions.css', import.meta.url), 'utf8'),
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
  // Reads the file as written, before the features that don't.
  raw: true,
};
