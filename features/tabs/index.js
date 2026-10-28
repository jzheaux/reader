/**
 * More than one version of a passage: the same code in Java and in Kotlin,
 * a build in Maven and in Gradle, a verse in two translations. A `:::`
 * block named `tabs` shows one version at a time, under a row of tabs; one
 * named `compare` shows them side by side, the words each differs by from
 * the one picked marked as in a diff:
 *
 *   ::: tabs                     ::: compare
 *   ```java                      +++ NIV
 *   http.oauth2Login(...);       LORD, you are my God; ...
 *   ```                          +++ KJV
 *                                O LORD, thou art my God; ...
 *   ```kotlin                    :::
 *   http { oauth2Login { } }
 *   ```
 *   :::
 *
 * Each block in one is a version, or, with `+++` lines, what's between two
 * is, named by the word after its `+++` (features/layout.js). A version
 * not named takes the name of its fence's language, or its number. The
 * first is the one showing, or the one compared against.
 *
 * Picking a version picks it in every block on the page that has one of the
 * same name, and is remembered, so it holds across renders and documents
 * (preview.js). Without the script, as in an export, each block still
 * switches on its own: a tab is a radio button, and the stylesheet shows
 * the pane of the one checked. On paper, every tab shows, one after another.
 *
 * The diff is by word, worked out here: each word not matched in another
 * version says which (`data-x`), and the stylesheet marks those against
 * the version picked. Text is compared ignoring case and punctuation; code,
 * apart from it, as written, each mark of punctuation a word.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import hljs from 'highlight.js';
import { opens, panes } from '../layout.js';
import { escapeHtml, escapeAttr, fenceLanguage } from '../source.js';

// How many versions the stylesheet can show the pick of.
const MAX = 12;
// A diff this many word pairs or more is too big to work out on every render.
const TOO_BIG = 4e6;

export function tabs(md) {
  md.block.ruler.before('fence', 'tabs', rule('tabs'), { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.block.ruler.before('fence', 'compare', rule('compare'), { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.core.ruler.push('compare_diff', diff);
  md.renderer.rules.tab_bar = (tokens, i) => `<div class="tab-bar">\n${tokens[i].meta.tabs.map(pick).join('\n')}\n</div>\n`;
  md.renderer.rules.tab_pick = (tokens, i) => `${pick(tokens[i].meta)}\n`;
  // Last of the features, so this is the fence as the others draw it.
  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, i, opts, env, self) => {
    const html = fence(tokens, i, opts, env, self);
    const ranges = tokens[i].meta?.diff;
    return ranges ? within(html, tokens[i].content, ranges) : html;
  };
}

/** The rule for a `name` layout: `tabs` or `compare`. */
function rule(name) {
  return (state, startLine, endLine, silent) => {
    if (!opens(state, startLine, name)) return false;
    if (silent) return true;

    const open = state.push(`${name}_open`, 'div', 1);
    open.attrs = [['class', name]];
    open.block = true;
    // An aside written in it or after it is about all of it (features/rows.js).
    open.meta = { whole: true };

    const { end, panes: versions } = panes(state, startLine, endLine, name);
    open.map = [startLine, Math.min(end + 1, endLine)];
    // Counted through the whole document: a deck's slides, its asides.
    const shared = state.env.shared ?? state.env;
    shared.tabs = (shared.tabs ?? 0) + 1;
    const group = `${name}-${shared.tabs}`;
    const tabs = versions.map((v, k) => {
      const label = v.label || named(v.tokens) || String(k + 1);
      return { group, label, key: label.toLowerCase(), checked: k === 0 };
    });

    if (name === 'tabs') {
      const bar = state.push('tab_bar', 'div', 0);
      bar.block = true;
      bar.meta = { tabs };
    }
    versions.forEach(({ tokens, map }, k) => {
      const pane = state.push(`${name}_pane_open`, 'div', 1);
      pane.attrs = [['class', name === 'tabs' ? 'tab-pane' : 'compare-pane'], ['data-tab', tabs[k].key], ['data-label', tabs[k].label]];
      pane.block = true;
      pane.map = map;
      if (name === 'compare') {
        const head = state.push('tab_pick', 'label', 0);
        head.block = true;
        head.meta = tabs[k];
      }
      state.tokens.push(...tokens);
      state.push(`${name}_pane_close`, 'div', -1).block = true;
    });

    state.push(`${name}_close`, 'div', -1).block = true;
    state.line = Math.min(end + 1, endLine);
    return true;
  };
}

/** The name of a version's fence's language, as highlight.js spells it. */
function named(tokens) {
  const fence = tokens.find((t) => t.type === 'fence');
  const lang = fence && fenceLanguage(fence.info);
  if (!lang) return null;
  return hljs.getLanguage(lang)?.name ?? lang;
}

/** A tab: a radio button, its label what's clicked. */
function pick({ group, label, key, checked }) {
  return `<label class="tab"><input type="radio" class="tab-pick" name="${escapeAttr(group)}" value="${escapeAttr(key)}"${checked ? ' checked' : ''}>${escapeHtml(label)}</label>`;
}

/**
 * Marks each word of a `compare` block's versions not matched in another
 * version, with which ones (`data-x`, counted from 1): the words of its
 * text, a run of them marked alike in one span, and, apart from those, the
 * words of its code.
 */
function diff(state) {
  const blocks = [];
  for (const t of state.tokens) {
    if (t.type === 'compare_open') blocks.push([]);
    else if (t.type === 'compare_pane_open') blocks.at(-1)?.push({ inlines: [], fences: [] });
    else if (t.type === 'compare_close') mark(state, blocks.pop() ?? []);
    else if (t.type === 'inline' && blocks.length) blocks.at(-1).at(-1)?.inlines.push(t);
    else if (t.type === 'fence' && blocks.length) blocks.at(-1).at(-1)?.fences.push(t);
  }
}

function mark(state, versions) {
  // Text, a text token at a time, split at its spaces.
  const parts = new Map();
  compare(versions.map(({ inlines }) => inlines
    .flatMap((t) => (t.children ?? []).filter((c) => c.type === 'text'))
    .flatMap((c) => {
      const split = c.content.split(/(\s+)/).map((text) => ({ text, key: keyOf(text), x: [] }));
      parts.set(c, split);
      return split.filter((p) => p.key);
    })));
  for (const { inlines } of versions) {
    for (const inline of inlines) {
      if (inline.children) inline.children = inline.children.flatMap((c) => parts.has(c) ? spans(state, parts.get(c)) : [c]);
    }
  }

  // Code, as it's written: each name, number and mark of punctuation.
  const words = versions.map(({ fences }) => fences.flatMap((fence) => [...fence.content.matchAll(CODE)]
    .map((m) => ({ fence, key: m[0], from: m.index, to: m.index + m[0].length, x: [] }))));
  compare(words);
  for (const w of words.flat()) {
    if (!w.x.length) continue;
    const x = w.x.join(' ');
    const ranges = (w.fence.meta ??= {}).diff ??= [];
    const last = ranges.at(-1);
    // Words marked alike, with only spaces between, are marked as one.
    if (last && last.x === x && /^[ \t]*$/.test(w.fence.content.slice(last.to, w.from))) last.to = w.to;
    else ranges.push({ from: w.from, to: w.to, x });
  }
}

/** Marks each word, in each list, with the lists it isn't matched in. */
function compare(lists) {
  for (let i = 0; i < lists.length; i++) {
    for (let j = i + 1; j < lists.length; j++) {
      const [a, b] = matched(lists[i].map((w) => w.key), lists[j].map((w) => w.key));
      lists[i].forEach((w, k) => { if (!a[k]) w.x.push(j + 1); });
      lists[j].forEach((w, k) => { if (!b[k]) w.x.push(i + 1); });
    }
  }
}

/** What a word of text is compared by: its letters and digits, in lower case. */
const keyOf = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// A word of code: a name or a number, or a single mark.
const CODE = /[\p{L}\p{N}_$]+|[^\s\p{L}\p{N}_$]/gu;

/**
 * Which items of `a` and of `b` are in a longest sequence common to both.
 * None are, when they're too long to compare.
 */
function matched(a, b) {
  const n = a.length;
  const m = b.length;
  const inA = new Array(n).fill(false);
  const inB = new Array(m).fill(false);
  if ((n + 1) * (m + 1) >= TOO_BIG) return [inA, inB];
  // lcs[i][j]: the longest common to a[i..] and b[j..]
  const w = m + 1;
  const lcs = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] = a[i] === b[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i] === b[j]) {
      inA[i++] = true;
      inB[j++] = true;
    } else if (lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) i++;
    else j++;
  }
  return [inA, inB];
}

/**
 * A text token's parts as tokens: a run of words marked alike, with the
 * spaces between them, in a span; what isn't marked, and the spaces at a
 * run's ends, as text.
 */
function spans(state, parts) {
  const out = [];
  const text = (content) => {
    if (!content) return;
    const t = new state.Token('text', '', 0);
    t.content = content;
    out.push(t);
  };
  let run = null;
  let between = '';
  const flush = () => {
    if (!run) return;
    if (!run.x) text(run.text);
    else {
      const open = new state.Token('compare_diff_open', 'span', 1);
      open.attrs = [['class', 'diff'], ['data-x', run.x]];
      out.push(open);
      text(run.text);
      out.push(new state.Token('compare_diff_close', 'span', -1));
    }
    run = null;
  };
  for (const p of parts) {
    if (!p.key) {
      between += p.text;
      continue;
    }
    const x = p.x.join(' ');
    if (run && run.x === x) run.text += between + p.text;
    else {
      flush();
      text(between);
      run = { x, text: p.text };
    }
    between = '';
  }
  flush();
  text(between);
  return out;
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'" };

/**
 * A fence's HTML with its words marked, the `ranges` of its `content` they
 * span: a mark is closed at each tag and opened again after it, so it
 * nests in the highlighting. HTML whose text isn't the fence's own (a
 * diagram, say) is left as it is.
 */
function within(html, content, ranges) {
  const start = html.indexOf('>', html.indexOf('<code')) + 1;
  const end = html.lastIndexOf('</code>');
  if (!start || end < start) return html;
  const parts = html.slice(start, end).split(/(<[^>]*>)/);
  const chars = parts.map((p, k) => (k % 2 ? null : p.match(/&[#\w]+;|[^&]/g) ?? []));
  const text = chars.flatMap((c) => c ?? []).map((c) => ENTITIES[c] ?? c).join('');
  if (text !== content) return html;
  let at = 0;
  let r = 0;
  const marked = parts.map((part, k) => {
    if (k % 2) return part;
    let out = '';
    let open = null;
    for (const c of chars[k]) {
      while (r < ranges.length && ranges[r].to <= at) r++;
      const range = ranges[r]?.from <= at ? ranges[r] : null;
      if (range !== open) {
        if (open) out += '</span>';
        if (range) out += `<span class="diff" data-x="${range.x}">`;
        open = range;
      }
      out += c;
      at++;
    }
    return open ? `${out}</span>` : out;
  });
  return html.slice(0, start) + marked.join('') + html.slice(end);
}

// Which pane shows, or is compared against: the one whose tab is checked.
const nth = Array.from({ length: MAX }, (_, k) => k + 1);
const picked = (k) => `.compare:has(> .compare-pane:nth-child(${k}) > .tab > input:checked)`;
const CSS = [
  fs.readFileSync(new URL('./tabs.css', import.meta.url), 'utf8'),
  `${nth.map((k) => `.tabs:has(> .tab-bar > .tab:nth-child(${k}) > input:checked) > .tab-pane:nth-child(${k + 1})`).join(',\n')} { visibility: visible; }`,
  // An aside written in a tab (columns.js) is beside the whole block, and shows with its tab.
  `@media screen { ${nth.map((k) => `.gm-pair:has(> .gm-speaker .tabs > .tab-bar > .tab:nth-child(${k}) > input:not(:checked)) .gm-aside-cell[data-in-tab="${k}"]`).join(',\n')} { display: none; } }`,
  `${nth.map((k) => `${picked(k)} > .compare-pane:nth-child(${k}) > .tab`).join(',\n')} { color: var(--gm-ink); border-bottom-color: var(--gm-accent); }`,
  `${nth.map((k) => `${picked(k)} > .compare-pane:nth-child(${k}) .diff`).join(',\n')} { background: var(--diff-removed); text-decoration: var(--diff-removed-line); }`,
  `${nth.map((k) => `${picked(k)} > .compare-pane:not(:nth-child(${k})) .diff[data-x~="${k}"]`).join(',\n')} { background: var(--diff-added); text-decoration: var(--diff-added-line); }`,
].join('\n');

export default {
  name: 'tabs',
  plugin: tabs,
  css: CSS,
  // Picks a version across the page, and remembers it.
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
};
