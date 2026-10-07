/**
 * Puzzles in the rendered page.
 *
 * A fence whose info string names a puzzle (```sudoku) comes from the server
 * wrapped as `<div class="puzzle" data-kind="sudoku" data-puzzle="k">`, its
 * text still inside as a code block, and is drawn here from that text. The
 * text is the whole of the puzzle's state: a move redraws the puzzle and posts
 * the new text up, and the editor writes it back into the fence, so progress
 * saves like typing and reads as plain text anywhere else.
 *
 * A puzzle whose board is kept in a file (```maze mazes/one.maze) comes with
 * that file's text in `data-source`. A kind sees the file's text and then the
 * fence's, as if they were one; it keeps the file's part as it was, and only
 * the fence's part is posted up, so the file is never written to.
 *
 * Click a puzzle (or Tab to it) to play; while it has focus it takes the
 * keys. Esc hands them back.
 *
 * A move goes up as an edit to the lines inside the fence, which the server
 * names as `data-from` and `data-to` (see edits.js), each line starting with
 * `data-prefix` for a puzzle in a quote or a list.
 *
 * Each kind lives in kinds/<kind>.js and registers itself here with
 * `mount(host, text, ui, post)`: draw the puzzle into `host` from `text`
 * (false if the text can't be read), keep what the reader was doing in `ui`,
 * and call `post(before, after)` with the fence's text after each move.
 * Alongside, without the page, it gives `parse(text)` (its state, or null),
 * `format(state)` (the text again), `solved(state)` and the `rules` a move
 * follows, which kinds.test.js checks.
 */
(() => {
  const KINDS = {};

  // What the reader was doing in each puzzle -- where the cursor was, whether
  // pencil marks were on -- kept across re-renders, which replace the page.
  const memory = new Map();

  function register(kind, impl, css = '') {
    KINDS[kind] = impl;
    if (css) addStyle(css);
  }

  /** Draws every puzzle under `root`; puzzle `focus`, if given, takes focus. */
  function hydrate(root, focus = null) {
    for (const host of root.querySelectorAll('.puzzle[data-kind]')) {
      const kind = KINDS[host.dataset.kind];
      if (!kind) continue;
      const index = Number(host.dataset.puzzle);
      // markdown leaves a code block ending in a newline the fence didn't have
      const own = (host.querySelector('code')?.textContent ?? '').replace(/\n$/, '');
      if (host.dataset.sourceError != null) {
        unreadable(host, host.dataset.sourceError);
        continue;
      }
      const source = host.dataset.source;
      const lead = source == null ? '' : `${source}\n`;
      const text = source == null ? own : `${lead}${own}`;
      if (!memory.has(index)) memory.set(index, {});
      // The fence's lines, kept up to date as moves change how many there
      // are, since the page isn't rendered again after a move.
      const from = Number(host.dataset.from);
      let to = Number(host.dataset.to);
      const prefix = host.dataset.prefix ?? '';
      const fenced = (t) => lines(t).map((l) => prefix + l);
      const send = (before, after) => {
        const edit = { from, to, before: fenced(before), after: fenced(after) };
        to = from + edit.after.length;
        Preview.edit([edit], { drawn: true });
      };
      const post = (before, after) => {
        if (!lead) return send(before, after);
        const fence = (t) => (t === source ? '' : t.startsWith(lead) ? t.slice(lead.length) : null);
        if (fence(before) !== null && fence(after) !== null) send(fence(before), fence(after));
        else console.warn(`puzzle ${index}: a move changed the board kept in its file; not saved`);
      };
      if (!kind.mount(host, text, memory.get(index), post)) {
        unreadable(host, source == null ? '' : 'its board file');
        continue;
      }
      host.tabIndex = 0;
      if (index === focus) host.focus({ preventScroll: true });
    }
  }

  const lines = (s) => (s === '' ? [] : s.split('\n'));

  function unreadable(host, why) {
    host.classList.add('puzzle-unreadable');
    if (!why) return;
    const note = document.createElement('p');
    note.className = 'puzzle-error';
    note.textContent = `Couldn't read ${why}`;
    host.prepend(note);
  }

  /** Keys a focused puzzle keeps from the page: all but shortcuts and Tab. */
  function owns(e) {
    return !e.metaKey && !e.ctrlKey && !e.altKey && e.key !== 'Tab';
  }

  /**
   * Puts `board` in `host` with a status bar under it and a list of `keys`
   * ([key, what it does] pairs) that `?` shows. Returns the bar and the list.
   */
  function frame(host, board, keys) {
    const bar = document.createElement('div');
    bar.className = 'puzzle-bar';
    const help = document.createElement('dl');
    help.className = 'puzzle-help';
    for (const [k, what] of keys) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = what;
      help.append(dt, dd);
    }
    host.replaceChildren(board, bar, help);
    return { bar, help };
  }

  function addStyle(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
  }

  addStyle(`
.puzzle { margin: 1rem 0; outline: none; break-inside: avoid; }
.puzzle-bar {
  font-family: var(--gm-sans); font-size: 0.8rem; color: var(--gm-ink-soft);
  margin-top: 0.4rem; min-height: 1.2em; visibility: hidden;
}
.puzzle:focus-within .puzzle-bar, .puzzle.solved .puzzle-bar { visibility: visible; }
.puzzle.solved .puzzle-bar { color: #2e7d32; font-weight: 600; font-size: 0.95rem; }
.puzzle-help {
  display: grid; grid-template-columns: max-content 1fr; gap: 0.15rem 0.8rem;
  font-family: var(--gm-sans); font-size: 0.8rem; margin: 0.4rem 0 0;
}
.puzzle-help[hidden] { display: none; }
.puzzle-help dt { font-weight: 600; }
.puzzle-help dd { margin: 0; color: var(--gm-ink-soft); }
.puzzle-unreadable pre { border-left: 3px solid #c62828; }
.puzzle-error { font-family: var(--gm-sans); font-size: 0.8rem; color: #c62828; margin: 0 0 0.3rem; }
@media print { .puzzle-bar, .puzzle-help { display: none; } }
`);

  // A puzzle being played keeps the keyboard through a re-render.
  Preview.register({
    keep: () => {
      const playing = document.hasFocus() && document.activeElement?.closest?.('.puzzle');
      return playing ? Number(playing.dataset.puzzle) : null;
    },
    restore: (root, playing) => hydrate(root, playing),
  });

  window.Puzzles = { register, hydrate, owns, frame };
})();
