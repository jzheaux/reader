/**
 * A fence named for a puzzle (```sudoku) is drawn as the puzzle and can be
 * played right on the page. The fence's text is the puzzle and the progress
 * made on it: each move is written back into the file, saved like typing.
 * Each kind of puzzle is a script in kinds/, named for the fence; see
 * preview.js for how they're drawn and played.
 *
 * Here, each puzzle fence is wrapped for the preview to draw:
 *
 *   <div class="puzzle" data-kind="sudoku" data-puzzle="k"
 *        data-from="f" data-to="t" data-prefix="> ">…the code block…</div>
 *
 * numbered in document order (across a deck's slides too, through
 * `env.shared`) so the preview can tell it's the same puzzle after a
 * re-render. `data-from` and `data-to` are the lines of the file inside the
 * fence, for a move to be written back to; `data-prefix` is what each of
 * those lines starts with, for a puzzle in a quote or a list. When the lines
 * don't all start the same way, or the puzzle is in an aside (whose lines
 * are counted apart from the file's), there are no lines to write to: the
 * puzzle can be seen but not played.
 *
 * A puzzle can keep its board in a file of its own, named after the kind
 * (```maze mazes/one.maze), so a big one doesn't fill the page; the fence
 * then holds only what's been played. The file is found next to the document
 * (`env.file`) and read with `env.read(path)`, which the server gives only
 * when it allows it; its text, or why it couldn't be read, is carried along
 * as `data-source` or `data-source-error`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeAttr } from '../source.js';

const KINDS_DIR = new URL('./kinds/', import.meta.url);

/** Every kind of puzzle: one for each script in kinds/. */
export const KINDS = fs.readdirSync(KINDS_DIR).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -'.js'.length)).sort();
const IS_KIND = new Set(KINDS);

export function puzzles(md) {
  // What each puzzle fence is, worked out while its parse's env is at hand
  // (an aside is parsed apart, with an env of its own).
  md.core.ruler.push('puzzle_fences', (state) => {
    const lines = state.src.split('\n');
    for (const t of state.tokens) {
      if (t.type !== 'fence') continue;
      const [kind, ref = ''] = t.info.trim().split(/\s+(.*)/);
      if (!IS_KIND.has(kind)) continue;
      t.meta = { ...t.meta, puzzle: { kind, ...where(t, lines, state.env), source: board(ref.trim(), state.env) } };
    }
  });

  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, i, opts, env, self) => {
    const html = fence(tokens, i, opts, env, self);
    const puzzle = tokens[i].meta?.puzzle;
    if (!puzzle) return html;
    // Numbered as drawn, which is document order.
    const shared = env.shared ?? (env.shared = {});
    const n = shared.puzzles = (shared.puzzles ?? 0);
    shared.puzzles++;
    const { kind, from, to, prefix, source } = puzzle;
    const lines = from == null ? '' : ` data-from="${from}" data-to="${to}"${prefix ? ` data-prefix="${escapeAttr(prefix)}"` : ''}`;
    const board = !source ? ''
      : source.error ? ` data-source-error="${escapeAttr(source.error)}"`
        : ` data-source="${escapeAttr(source.text)}"`;
    return `<div class="puzzle" data-kind="${kind}" data-puzzle="${n}"${lines}${board}>${html.replace(/\n$/, '')}</div>\n`;
  };
}

/**
 * The lines of the file inside the fence, `from` up to `to`, and what each
 * of them starts with in the file. Nothing for a fence in an aside, whose
 * lines are counted apart from the file's.
 */
function where(token, lines, env) {
  if (env.__aside || !token.map) return {};
  const [open, end] = token.map;
  const body = token.content ? token.content.replace(/\n$/, '').split('\n') : [];
  // Each line inside the fence is its prefix and then its text; with none
  // inside yet, the closing fence's line shows what a first one would need.
  const prefixes = body.map((text, k) => {
    const line = lines[open + 1 + k] ?? '';
    return line.endsWith(text) ? line.slice(0, line.length - text.length) : null;
  });
  if (!body.length && end - 1 > open) {
    const close = lines[end - 1] ?? '';
    const at = close.indexOf(token.markup);
    prefixes.push(at >= 0 ? close.slice(0, at) : null);
  }
  const prefix = prefixes.every((p) => p === prefixes[0]) ? prefixes[0] ?? '' : null;
  if (prefix === null) return {};
  const from = (env.lineBase ?? 0) + (env.sourceLines?.[open] ?? open) + 1;
  return { from, to: from + body.length, prefix };
}

/** A board file named after the kind, read next to the document. */
function board(ref, env) {
  if (!ref) return null;
  const rel = path.posix.normalize(path.posix.join(path.posix.dirname(env.file || ''), ref));
  try {
    if (!env.read) throw new Error('no files to read from');
    return { text: env.read(rel).replace(/\r\n?/g, '\n').replace(/\n+$/, '') };
  } catch (err) {
    return { error: `${ref}: ${err.message}` };
  }
}

export default {
  name: 'puzzles',
  plugin: puzzles,
  // The core first, then each kind, which registers itself with it.
  preview: [
    fileURLToPath(new URL('./preview.js', import.meta.url)),
    ...KINDS.map((kind) => fileURLToPath(new URL(`${kind}.js`, KINDS_DIR))),
  ],
};
