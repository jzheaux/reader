/**
 * Markdown -> a deck of rendered slides, in the format of
 * https://github.com/maaslalani/slides, so one file presents both in the
 * terminal and here:
 *
 *   ---                      optional front matter (author, date, paging, ...)
 *   author: Josh
 *   ---
 *
 *   # First slide
 *
 *   <!-- speaker notes -->
 *
 *   ---
 *
 *   # Second slide
 *
 * A line that is exactly `---` ends a slide, unless it is inside a code fence.
 * HTML comments are lifted out of a slide as its speaker notes: `slides`
 * sanitizes them away, so they never show in the terminal either.
 */

import path from 'node:path';
import { render } from './render.js';

const SEPARATOR = /^---[ \t]*$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const META = /^[ \t]*[\w-]+[ \t]*:/;
const NOTE = /<!--([\s\S]*?)-->/g;

/** Is there a slide break in `src` after its front matter? */
export function isDeck(src) {
  return split(src).slides.length > 1;
}

export function slides(src, { file, read } = {}) {
  const { meta, slides: chunks } = split(src);
  const title = meta.title || (file ? path.basename(file, path.extname(file)) : 'Untitled');
  let css = '';
  const out = [];
  // Kept by features across the slides, to number things through the deck.
  const shared = {};
  for (const { text, line } of chunks) {
    const { body, notes } = lift(text);
    if (!body.trim() && !notes) continue;
    const r = render(body, { file, read, line, shared });
    css ||= `${r.css}\n${CSS}`;
    out.push({ body: unmast(r.body), notes, line });
  }
  return { css: css || CSS, title, meta, slides: out };
}

/**
 * Cuts `src` into slides, each with the 0-based line it starts on. Front
 * matter is taken only when every line in it reads as `key: value`, so a
 * deck that opens with a bare `---` rule isn't swallowed whole.
 */
export function split(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const meta = {};
  let i = 0;
  if (SEPARATOR.test(lines[0] ?? '')) {
    const end = lines.findIndex((l, n) => n > 0 && SEPARATOR.test(l));
    const inner = end > 0 ? lines.slice(1, end) : [];
    if (end > 0 && inner.every((l) => !l.trim() || META.test(l))) {
      for (const l of inner) {
        const at = l.indexOf(':');
        if (at > 0) meta[l.slice(0, at).trim().toLowerCase()] = unquote(l.slice(at + 1).trim());
      }
      i = end + 1;
    }
  }

  const out = [];
  let start = i;
  let fence = null;
  for (; i <= lines.length; i++) {
    const l = lines[i];
    if (i === lines.length || (!fence && SEPARATOR.test(l))) {
      out.push({ text: lines.slice(start, i).join('\n'), line: start });
      start = i + 1;
      continue;
    }
    fence = fenced(fence, l);
  }
  return { meta, slides: out.filter((s) => s.text.trim()) };
}

/**
 * Separates a slide's speaker notes (its HTML comments) from its content. A
 * note leaves its line breaks behind, so each line of the content is still
 * on the line it was in the file.
 */
export function lift(text) {
  const notes = [];
  const lines = text.split('\n');
  let fence = null;
  // Only comments outside code fences are notes; mask the fenced lines first.
  const masked = lines.map((l) => {
    const inside = fence || FENCE.test(l);
    fence = fenced(fence, l);
    return inside ? '\0'.repeat(l.length) : l;
  }).join('\n');

  let body = '';
  let last = 0;
  for (const m of masked.matchAll(NOTE)) {
    body += text.slice(last, m.index) + m[0].replace(/[^\n]/g, '');
    notes.push(dedent(m[1]));
    last = m.index + m[0].length;
  }
  body += text.slice(last);
  return { body, notes: notes.filter(Boolean).join('\n\n') };
}

/** The fence still open after line `l`, given the one open before it. */
function fenced(fence, l) {
  const f = FENCE.exec(l);
  if (!f) return fence;
  if (!fence) return f[1];
  const closes = f[1][0] === fence[0] && f[1].length >= fence.length && !l.trim().slice(f[1].length).trim();
  return closes ? null : fence;
}

function dedent(s) {
  const lines = s.replace(/^\n+|\s+$/g, '').split('\n');
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)[0].length));
  return lines.map((l) => l.slice(Number.isFinite(pad) ? pad : 0)).join('\n').trim();
}

function unquote(v) {
  return /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v;
}

/** A slide is not a document: drop the title masthead gutter-md puts on top. */
function unmast(body) {
  return body.replace(/<header class="gm-masthead">[\s\S]*?<\/header>\s*/, '');
}

// Scaled to the window, and centered on it, like a projected slide. The
// `:root` prefix outranks the preview frame's own pane-sized rules.
const CSS = `
:root { --gm-base: clamp(14px, 2.1vw, 40px); }
:root body { overflow: hidden; }
:root .gm-doc {
  max-width: none; min-height: 100vh; margin: 0;
  padding: 6vh 8vw;
  display: flex; flex-direction: column; justify-content: center;
}
:root .gm-doc h1 { font-size: 2.6rem; line-height: 1.12; margin: 0 0 0.5em; }
:root .gm-doc h2 { font-size: 1.9rem; line-height: 1.15; margin: 0 0 0.6em; }
:root .gm-doc pre { font-size: 0.8rem; }
:root .gm-doc:not(:has(.gm-asides)) .gm-pair { grid-template-columns: 1fr; }
`;
