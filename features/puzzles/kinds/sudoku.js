/**
 * Sudoku, played in the rendered page. See puzzles.js.
 *
 *   ```sudoku
 *   5 3 . | . 7 . | . . .    5 3 4 | . 7 . | . . .
 *   6 . . | 1 9 5 | . . .    6 . . | 1 9 5 | . . .
 *   ------+-------+------    ------+-------+------
 *   ...
 *   notes: r1c4=26 r2c2=47
 *   ```
 *
 * Each row is the puzzle as given, then the board as played so far; the
 * givens can't be overwritten because they're kept apart. Only digits and
 * dots count, so the bars and rules are for the eye. A row may leave out the
 * board (a fresh puzzle). Pencil marks are listed by row and column.
 */
(() => {
  const { owns } = Puzzles;

  const CSS = `
.sudoku-grid {
  --cell: min(2.6rem, 9vw);
  --thick: 2.5px;
  display: grid; grid-template-columns: repeat(9, var(--cell));
  width: max-content; border: var(--thick) solid var(--gm-ink, #222);
  font-family: var(--gm-sans); user-select: none; cursor: pointer;
  background: var(--gm-paper, #fff);
}
.deck .sudoku-grid { --cell: min(3.9vh, 4.5vw); }
.sudoku-grid .cell {
  width: var(--cell); height: var(--cell); box-sizing: border-box;
  display: grid; place-items: center;
  border-right: 1px solid #b9b5ad; border-bottom: 1px solid #b9b5ad;
  font-size: calc(var(--cell) * 0.55); line-height: 1;
  color: #2457a6;
}
.sudoku-grid .cell:nth-child(9n) { border-right: 0; }
.sudoku-grid .cell:nth-last-child(-n + 9) { border-bottom: 0; }
.sudoku-grid .box-right { border-right: var(--thick) solid var(--gm-ink, #222); }
.sudoku-grid .box-bottom { border-bottom: var(--thick) solid var(--gm-ink, #222); }
.sudoku-grid .given { color: var(--gm-ink, #222); font-weight: 600; }
.puzzle:focus-within .sudoku-grid .peer { background: #f1efe9; }
.puzzle:focus-within .sudoku-grid .same { background: #e3ebf7; }
.puzzle:focus-within .sudoku-grid .cursor { background: #c9daf5; }
.sudoku-grid .conflict { color: #c62828; background: #fbe9e7; }
.puzzle:focus-within .sudoku-grid .conflict.cursor { background: #f6cfc9; }
.puzzle.pencil:focus-within .sudoku-grid .cursor { box-shadow: inset 0 0 0 2px #e0a800; }
.sudoku-grid .marks {
  display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; height: 100%;
  font-size: calc(var(--cell) * 0.22); color: var(--gm-ink-soft, #777); font-weight: 400;
}
.sudoku-grid .marks span { display: grid; place-items: center; }
.puzzle.solved .sudoku-grid { border-color: #2e7d32; }
@media print { .sudoku-grid .cell { background: none !important; } }
`;

  const UNITS = (() => {
    const units = [];
    for (let k = 0; k < 9; k++) {
      units.push([...Array(9)].map((_, j) => k * 9 + j));
      units.push([...Array(9)].map((_, j) => j * 9 + k));
      const r = 3 * Math.floor(k / 3);
      const c = 3 * (k % 3);
      units.push([...Array(9)].map((_, j) => (r + Math.floor(j / 3)) * 9 + c + (j % 3)));
    }
    return units;
  })();
  const PEERS = [...Array(81)].map((_, i) => new Set(UNITS.filter((u) => u.includes(i)).flat()));

  function parseSudoku(text) {
    const rows = [];
    const notes = new Map();
    for (const line of text.split('\n')) {
      if (/^\s*notes\s*:/i.test(line)) {
        for (const [, r, c, ds] of line.matchAll(/r([1-9])c([1-9])\s*=\s*([1-9]+)/gi)) {
          notes.set((r - 1) * 9 + (c - 1), new Set([...ds].map(Number)));
        }
        continue;
      }
      const cells = line.match(/[1-9.]/g) || [];
      if (cells.length >= 9) rows.push(cells);
    }
    if (rows.length !== 9) return null;
    const givens = rows.flatMap((r) => r.slice(0, 9)).map((v) => (v === '.' ? 0 : Number(v)));
    const board = rows.flatMap((r) => (r.length >= 18 ? r.slice(9, 18) : r.slice(0, 9)))
      .map((v, i) => givens[i] || (v === '.' ? 0 : Number(v)));
    for (const i of notes.keys()) if (board[i]) notes.delete(i);
    return { givens, board, notes };
  }

  function formatSudoku({ givens, board, notes }) {
    const row = (g, r) => [0, 1, 2]
      .map((b) => g.slice(r * 9 + b * 3, r * 9 + b * 3 + 3).map((v) => v || '.').join(' '))
      .join(' | ');
    const rule = '------+-------+------';
    const lines = [];
    for (let r = 0; r < 9; r++) {
      if (r === 3 || r === 6) lines.push(`${rule}    ${rule}`);
      lines.push(`${row(givens, r)}    ${row(board, r)}`);
    }
    const marks = [...notes.entries()]
      .filter(([, ds]) => ds.size)
      .sort(([a], [b]) => a - b)
      .map(([i, ds]) => `r${Math.floor(i / 9) + 1}c${(i % 9) + 1}=${[...ds].sort().join('')}`);
    if (marks.length) lines.push(`notes: ${marks.join(' ')}`);
    return lines.join('\n');
  }

  /** Cells whose digit repeats in a row, column or box. */
  function conflicts(board) {
    const bad = new Set();
    for (const unit of UNITS) {
      const seen = new Map();
      for (const i of unit) {
        const v = board[i];
        if (!v) continue;
        if (seen.has(v)) bad.add(i).add(seen.get(v));
        else seen.set(v, i);
      }
    }
    return bad;
  }

  const SUDOKU_KEYS = [
    ['← → ↑ ↓', 'move'],
    ['1–9', 'fill in a number (again to erase it)'],
    ['⇧ 1–9', 'pencil mark'],
    ['n', 'pencil marks on / off'],
    ['⌫ or 0', 'erase'],
    ['Esc', 'done for now'],
  ];

  Puzzles.register('sudoku', {
    mount(host, text, ui, post) {
      const s = parseSudoku(text);
      if (!s) return false;
      let source = text;
      if (ui.cursor == null) ui.cursor = Math.max(0, s.givens.findIndex((v) => !v));

      const grid = document.createElement('div');
      grid.className = 'sudoku-grid';
      const cells = [...Array(81)].map((_, i) => {
        const cell = document.createElement('div');
        cell.dataset.i = i;
        grid.append(cell);
        return cell;
      });
      const { bar, help } = Puzzles.frame(host, grid, SUDOKU_KEYS);
      host.setAttribute('aria-label', 'Sudoku');

      function draw() {
        const bad = conflicts(s.board);
        const at = ui.cursor;
        const v = s.board[at];
        for (const [i, cell] of cells.entries()) {
          const cls = ['cell'];
          if (s.givens[i]) cls.push('given');
          if (i === at) cls.push('cursor');
          else if (PEERS[at].has(i)) cls.push('peer');
          if (v && s.board[i] === v) cls.push('same');
          if (bad.has(i)) cls.push('conflict');
          if (i % 9 === 2 || i % 9 === 5) cls.push('box-right');
          if (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5) cls.push('box-bottom');
          cell.className = cls.join(' ');
          if (s.board[i]) {
            cell.textContent = s.board[i];
          } else if (s.notes.get(i)?.size) {
            const marks = document.createElement('div');
            marks.className = 'marks';
            for (let d = 1; d <= 9; d++) {
              const m = document.createElement('span');
              m.textContent = s.notes.get(i).has(d) ? d : '';
              marks.append(m);
            }
            cell.replaceChildren(marks);
          } else {
            cell.textContent = '';
          }
        }
        const solved = !bad.size && s.board.every(Boolean);
        host.classList.toggle('solved', solved);
        host.classList.toggle('pencil', Boolean(ui.pencil));
        bar.textContent = solved
          ? 'Solved! 🎉'
          : `${ui.pencil ? '✏️ Pencil marks on · ' : ''}? for keys`;
        help.hidden = !ui.help;
      }

      function commit() {
        const after = formatSudoku(s);
        if (after !== source) post(source, after);
        source = after;
        draw();
      }

      function fill(d, pencil) {
        const i = ui.cursor;
        if (s.givens[i]) return;
        if (pencil) {
          if (s.board[i]) return;
          const ds = s.notes.get(i) ?? new Set();
          if (ds.has(d)) ds.delete(d);
          else ds.add(d);
          s.notes.set(i, ds);
        } else {
          s.board[i] = s.board[i] === d ? 0 : d;
          s.notes.delete(i);
        }
        commit();
      }

      function erase() {
        const i = ui.cursor;
        if (s.givens[i]) return;
        s.board[i] = 0;
        s.notes.delete(i);
        commit();
      }

      function move(dr, dc) {
        const r = Math.min(8, Math.max(0, Math.floor(ui.cursor / 9) + dr));
        const c = Math.min(8, Math.max(0, (ui.cursor % 9) + dc));
        ui.cursor = r * 9 + c;
        draw();
      }

      host.addEventListener('keydown', (e) => {
        if (!owns(e)) return;
        e.preventDefault();
        e.stopPropagation();
        const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
        if (digit && digit[1] !== '0') return fill(Number(digit[1]), e.shiftKey || ui.pencil);
        switch (e.key) {
          case 'ArrowUp': return move(-1, 0);
          case 'ArrowDown': return move(1, 0);
          case 'ArrowLeft': return move(0, -1);
          case 'ArrowRight': return move(0, 1);
          case 'Backspace': case 'Delete': case '0': case '.': case ' ': return erase();
          case 'n': case 'N': ui.pencil = !ui.pencil; return draw();
          case '?': ui.help = !ui.help; return draw();
          case 'Escape': return host.blur();
          default:
        }
      });
      grid.addEventListener('click', (e) => {
        const cell = e.target.closest('[data-i]');
        if (!cell) return;
        ui.cursor = Number(cell.dataset.i);
        host.focus({ preventScroll: true });
        draw();
      });

      draw();
      return true;
    },
  }, CSS);
})();
