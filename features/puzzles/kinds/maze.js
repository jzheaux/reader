/**
 * Mazes, played in the rendered page. See ../preview.js.
 *
 *   ```maze                         ```maze mazes/one.maze
 *   +--+--+--+                      path: D2 R
 *   |S    |  |                      notes: r1c3
 *   +--+  +  +                      ```
 *   |     | E|
 *   +--+--+--+
 *   path: R D
 *   notes: r1c3
 *   ```
 *
 * The maze is drawn the way it would be on paper, either with `+` at the
 * corners, `-` across and `|` down (each cell as wide as the space between
 * two `+`s), or two characters to a cell, its floor and its right-hand wall:
 *
 *    _______
 *   |S  |  _|
 *   |_|___ E|
 *
 * Only the walls are read -- `-` (or `_`) and `|` where a wall can go -- so
 * any other character is open floor. `S` is where the way starts and `E` is
 * where it ends: in a cell, or in place of a wall, for a way in through the
 * edge of the maze (the cell on the side that isn't blank out to the edge,
 * the maze side, is where it starts or ends, and the letter is shown just
 * outside, like an arrow pointing the way in or out). A maze with a shape (a heart, a word) is the same: whatever
 * the start can't get to is never played. A big maze can be kept in a file of
 * its own, named after the kind; the fence then holds only what's been played.
 *
 * `path:` is the way taken so far from S, as moves Up, Down, Left and Right,
 * a number after one for more of the same (`D3` = down 3). Stepping back the
 * way you came takes the step off, so it's the way you're on, not every turn
 * tried. `notes:` are pencil marks, a row and column each (`r7c1`): wherever
 * you like, say to rule out a way that dead-ends.
 */
(() => {
  const { owns } = Puzzles;

  const PROGRESS = /^\s*(path|notes)\s*:(.*)$/i;
  const DIRS = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
  const BACK = { U: 'D', D: 'U', L: 'R', R: 'L' };

  function parseMaze(text) {
    const art = [];
    let moves = '';
    let notes = '';
    for (const line of text.split('\n')) {
      const p = PROGRESS.exec(line);
      if (!p) art.push(line);
      else if (p[1].toLowerCase() === 'path') moves = p[2];
      else notes = p[2];
    }
    while (art.length && !art[0].trim()) art.shift();
    while (art.length && !art[art.length - 1].trim()) art.pop();
    const m = art.some((l) => l.includes('+')) ? plusGrid(art) : barGrid(art);
    if (!m || !m.start || !m.end) return null;
    m.art = art;
    m.path = walk(m, moves);
    m.notes = [];
    for (const [, r, c] of notes.matchAll(/r(\d+)\s*c(\d+)/gi)) {
      const at = [r - 1, c - 1];
      if (inside(m, at) && !m.notes.some((n) => same(n, at))) m.notes.push(at);
    }
    return m;
  }

  /**
   * A maze drawn with `+` corners. Lines alternate: corners and the walls
   * between them, then the cells. `top[r][c]` is the wall above cell r,c (r up
   * to R, for the bottom), `left[r][c]` the wall left of it (c up to C).
   */
  function plusGrid(lines) {
    lines = lines.slice(lines.findIndex((l) => l.includes('+')));
    const xs = [];
    let w = Infinity;
    lines.forEach((l, i) => {
      if (i % 2) return;
      let last = -1;
      for (let x = l.indexOf('+'); x >= 0; x = l.indexOf('+', x + 1)) {
        xs.push(x);
        if (last >= 0) w = Math.min(w, x - last);
        last = x;
      }
    });
    if (!xs.length || w === Infinity || w < 2) return null;
    const x0 = Math.min(...xs);
    const C = Math.round((Math.max(...xs) - x0) / w);
    const R = Math.floor(lines.length / 2);
    if (!R || !C) return null;
    const ch = (y, x) => (lines[y] ?? '')[x] ?? ' ';
    const span = (y, c) => Array.from({ length: w - 1 }, (_, k) => ch(y, x0 + c * w + 1 + k));
    const m = grid(R, C);
    for (let r = 0; r <= R; r++) {
      for (let c = 0; c <= C; c++) {
        if (c < C) {
          const across = span(2 * r, c);
          const k = across.findIndex(isEnd);
          if (k < 0) m.top[r][c] = across.some((x) => x !== ' ');
          else door(m, across[k], 'top', r, c, ...outside(lines, 2 * r, x0 + c * w + 1 + k, true));
        }
        if (r < R) {
          const x = x0 + c * w;
          const down = ch(2 * r + 1, x);
          if (!isEnd(down)) m.left[r][c] = down !== ' ';
          else door(m, down, 'left', r, c, ...outside(lines, 2 * r + 1, x, false));
        }
        if (r < R && c < C) mark(m, span(2 * r + 1, c), r, c);
      }
    }
    return m;
  }

  /**
   * A maze drawn two characters to a cell: its floor, `_` or not, then its
   * right-hand wall, `|` or not. An opening line with no `|` is the top edge.
   */
  function barGrid(lines) {
    const top = lines.length && !lines[0].includes('|') ? lines[0] : null;
    const rows = top == null ? lines : lines.slice(1);
    const xs = rows.map((l) => l.indexOf('|')).filter((x) => x >= 0);
    if (!xs.length) return null;
    const x0 = Math.min(...xs);
    const R = rows.length;
    const C = Math.max(...rows.map((l) => Math.ceil((l.trimEnd().length - x0 - 1) / 2)));
    if (!R || C < 1) return null;
    const ch = (l, x) => (l ?? '')[x] ?? ' ';
    const m = grid(R, C);
    for (let r = 0; r <= R; r++) {
      const above = r ? rows[r - 1] : top;
      for (let c = 0; c <= C; c++) {
        // A letter on the floor of a cell is in that cell, except along the
        // top edge, where there's no cell above to hold it.
        const floor = ch(above, x0 + 2 * c + 1);
        if (c < C && r === 0 && isEnd(floor)) door(m, floor, 'top', 0, c, true, false);
        else if (c < C) m.top[r][c] = floor === '_';
        const wall = ch(rows[r], x0 + 2 * c);
        if (r < R && isEnd(wall)) door(m, wall, 'left', r, c, ...outside(rows, r, x0 + 2 * c, false));
        else if (r < R) m.left[r][c] = wall === '|';
        if (r < R && c < C) mark(m, [ch(rows[r], x0 + 2 * c + 1)], r, c);
      }
    }
    return m;
  }

  function grid(R, C) {
    const fill = (h, w) => Array.from({ length: h }, () => Array(w).fill(false));
    return {
      R, C, top: fill(R + 1, C), left: fill(R, C + 1), start: null, end: null, doors: new Set(), labels: {},
    };
  }

  const isEnd = (ch) => ch === 'S' || ch === 'E';

  /**
   * Is everything beyond `x` on line `y` blank out to the edge, on either
   * side? Up and down the column if `across` (a letter in a wall across),
   * else along the line (a letter in a wall down). [before, after].
   */
  function outside(lines, y, x, across) {
    const blank = (s) => !s.trim();
    if (!across) return [blank((lines[y] ?? '').slice(0, x)), blank((lines[y] ?? '').slice(x + 1))];
    const col = (from, to) => lines.slice(from, to).map((l) => l[x] ?? ' ').join('');
    return [blank(col(0, y)), blank(col(y + 1))];
  }

  /**
   * `letter` in place of the wall `side` ('top' or 'left') of cell r,c: a
   * way in or out. It belongs to the cell on the maze side of the wall, and
   * the gap is drawn open but can't be walked through, out of the maze.
   */
  function door(m, letter, side, r, c, beforeBlank, afterBlank) {
    const before = side === 'top' ? [r - 1, c] : [r, c - 1];
    const after = [r, c];
    const ins = [before, after].filter((p) => inside(m, p));
    const at = ins.length === 1 ? ins[0] : beforeBlank && !afterBlank ? after : afterBlank && !beforeBlank ? before : after;
    if (!ins.length) return;
    m[side][r][c] = true;
    m.doors.add(`${side} ${r} ${c}`);
    const key = letter === 'S' ? 'start' : 'end';
    if (m[key]) return;
    m[key] = at;
    m.labels[letter] = at === after ? before : after;
  }

  function mark(m, chars, r, c) {
    if (chars.includes('S') && !m.start) m.start = [r, c];
    if (chars.includes('E') && !m.end) m.end = [r, c];
  }

  const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
  const inside = ({ R, C }, [r, c]) => r >= 0 && r < R && c >= 0 && c < C;

  /** Can you step from `at` in direction `d` (a DIRS key)? */
  function open(m, [r, c], d) {
    switch (d) {
      case 'U': return r > 0 && !m.top[r][c];
      case 'D': return r < m.R - 1 && !m.top[r + 1][c];
      case 'L': return c > 0 && !m.left[r][c];
      case 'R': return c < m.C - 1 && !m.left[r][c + 1];
      default: return false;
    }
  }

  const step = ([r, c], d) => [r + DIRS[d][0], c + DIRS[d][1]];
  const dirTo = (a, b) => Object.keys(DIRS).find((d) => same(step(a, d), b));

  /** The cells `moves` goes through from the start, as far as it can go. */
  function walk(m, moves) {
    const path = [m.start];
    for (const [, d, n] of moves.toUpperCase().matchAll(/([UDLR])\s*(\d*)/g)) {
      for (let k = 0; k < (n ? Number(n) : 1); k++) {
        if (!extend(m, path, d)) return path;
      }
    }
    return path;
  }

  /** One step on from the end of `path`; a step back takes the last one off. */
  function extend(m, path, d) {
    const head = path[path.length - 1];
    if (!open(m, head, d)) return false;
    const next = step(head, d);
    if (same(next, path[path.length - 2])) path.pop();
    else path.push(next);
    return true;
  }

  function formatMaze(m) {
    const runs = [];
    for (let i = 1; i < m.path.length; i++) {
      const d = dirTo(m.path[i - 1], m.path[i]);
      const last = runs[runs.length - 1];
      if (last && last.d === d) last.n++;
      else runs.push({ d, n: 1 });
    }
    return [
      ...m.art,
      `path: ${runs.map(({ d, n }) => (n > 1 ? `${d}${n}` : d)).join(' ')}`.trimEnd(),
      `notes: ${m.notes.map(([r, c]) => `r${r + 1}c${c + 1}`).join(' ')}`.trimEnd(),
    ].join('\n');
  }

  /** The ways out of `at`. */
  const exits = (m, at) => Object.keys(DIRS).filter((d) => open(m, at, d));

  /** The shortest way from `a` to `b` within `limit` steps, as directions; or null. */
  function route(m, a, b, limit = 12) {
    const seen = new Map([[String(a), '']]);
    let frontier = [a];
    for (let k = 0; k < limit && frontier.length; k++) {
      const next = [];
      for (const p of frontier) {
        for (const d of exits(m, p)) {
          const q = step(p, d);
          if (seen.has(String(q))) continue;
          const way = seen.get(String(p)) + d;
          if (same(q, b)) return way;
          seen.set(String(q), way);
          next.push(q);
        }
      }
      frontier = next;
    }
    return null;
  }

  /** The way taken so far ends at E. */
  const isSolved = (m) => same(m.path[m.path.length - 1], m.end);

  const MAZE_KEYS = [
    ['← → ↑ ↓', 'go that way, on to the next turn-off'],
    ['drag', 'draw your way (drag back to take it back)'],
    ['⌫', 'take back one step'],
    ['Shift + ← → ↑ ↓', 'pencil mark the way that way, or rub it out'],
    ['X', 'pencil mark where you are'],
    ['right-click, Shift-click, or hold', 'pencil mark a spot, or rub it out'],
    ['Esc', 'done for now'],
  ];

  const SVGNS = 'http://www.w3.org/2000/svg';
  function el(name, attrs = {}, text) {
    const e = document.createElementNS(SVGNS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  }

  const PAD = 0.3;

  Puzzles.register('maze', {
    parse: parseMaze,
    format: formatMaze,
    solved: isSolved,
    rules: { walk, extend, route },
    mount(host, text, ui, post) {
      const m = parseMaze(text);
      if (!m) return false;
      const { R, C } = m;
      let source = text;

      // The maze, and room around it for a letter shown outside an opening.
      const label = (letter) => m.labels[letter] ?? (letter === 'S' ? m.start : m.end);
      const outs = ['S', 'E'].map(label);
      const vx = Math.min(0, ...outs.map((p) => p[1])) - PAD;
      const vy = Math.min(0, ...outs.map((p) => p[0])) - PAD;
      const vw = Math.max(C, ...outs.map((p) => p[1] + 1)) + PAD - vx;
      const vh = Math.max(R, ...outs.map((p) => p[0] + 1)) + PAD - vy;
      const svg = el('svg', { viewBox: `${vx} ${vy} ${vw} ${vh}`, class: 'mz-grid', role: 'img' });
      svg.style.setProperty('--cols', vw);
      svg.style.setProperty('--rows', vh);
      const { bar, help } = Puzzles.frame(host, svg, MAZE_KEYS);
      host.setAttribute('aria-label', 'Maze');

      // The walls never change: drawn once.
      const d = [];
      for (let r = 0; r <= R; r++) {
        for (let c = 0; c <= C; c++) {
          if (c < C && m.top[r][c] && !m.doors.has(`top ${r} ${c}`)) d.push(`M${c} ${r}h1`);
          if (r < R && m.left[r][c] && !m.doors.has(`left ${r} ${c}`)) d.push(`M${c} ${r}v1`);
        }
      }
      const walls = el('path', { d: d.join(''), class: 'wall' });

      let flash = '';
      let flashTimer = 0;
      function say(msg) {
        flash = msg;
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => { flash = ''; draw(); }, 1600);
      }

      const mid = ([r, c]) => [c + 0.5, r + 0.5];
      const head = () => m.path[m.path.length - 1];

      function draw() {
        const parts = [el('rect', { x: vx, y: vy, width: vw, height: vh, class: 'paper' })];
        for (const [r, c] of m.notes) {
          const k = 0.2;
          parts.push(el('path', {
            d: `M${c + 0.5 - k} ${r + 0.5 - k}l${2 * k} ${2 * k}m0 ${-2 * k}l${-2 * k} ${2 * k}`, class: 'note',
          }));
        }
        for (const letter of ['S', 'E']) {
          const [x, y] = mid(label(letter));
          parts.push(el('text', { x, y: y + 0.27, class: `end-${letter}` }, letter));
        }
        if (m.path.length > 1) {
          parts.push(el('polyline', { points: m.path.map((p) => mid(p).join(',')).join(' '), class: 'way' }));
        }
        if (m.path.length > 1) {
          const [hx, hy] = mid(head());
          parts.push(el('circle', { cx: hx, cy: hy, r: 0.3, class: 'head' }));
        }
        parts.push(walls);
        svg.replaceChildren(...parts);

        const done = isSolved(m);
        host.classList.toggle('solved', done);
        bar.textContent = done ? 'You made it through! 🎉' : flash || `${m.path.length - 1} steps · ? for keys`;
        help.hidden = !ui.help;
      }

      function commit() {
        const after = formatMaze(m);
        if (after !== source) post(source, after);
        source = after;
        draw();
      }

      function note(at) {
        if (!inside(m, at)) return;
        const k = m.notes.findIndex((n) => same(n, at));
        if (k >= 0) m.notes.splice(k, 1);
        else m.notes.push(at);
        commit();
      }

      /**
       * Go `d` from the end of the way, and on along the corridor until it
       * comes to a turn-off, a dead end, a pencil mark or either end.
       */
      function run(d) {
        if (!open(m, head(), d)) { say('There’s a wall that way'); return draw(); }
        extend(m, m.path, d);
        for (let guard = R * C; guard > 0; guard--) {
          const at = head();
          if (same(at, m.end) || same(at, m.start) || m.notes.some((n) => same(n, at))) break;
          const ways = exits(m, at);
          if (ways.length !== 2) break;
          d = ways.find((x) => x !== BACK[d]);
          extend(m, m.path, d);
        }
        commit();
      }

      const ARROWS = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R' };
      host.addEventListener('keydown', (e) => {
        if (!owns(e)) return;
        e.preventDefault();
        e.stopPropagation();
        const dir = ARROWS[e.key];
        if (dir && e.shiftKey) return note(step(head(), dir));
        if (dir) return run(dir);
        switch (e.key) {
          case 'Backspace': case 'Delete':
            if (m.path.length > 1) { m.path.pop(); return commit(); }
            return draw();
          case 'x': case 'X': return note(head());
          case '?': ui.help = !ui.help; return draw();
          case 'Escape': return host.blur();
          default:
        }
      });

      const cellAt = (e) => {
        const box = svg.getBoundingClientRect();
        const x = ((e.clientX - box.left) / box.width) * vw + vx;
        const y = ((e.clientY - box.top) / box.height) * vh + vy;
        const at = [Math.floor(y), Math.floor(x)];
        return inside(m, at) ? at : null;
      };

      /** The pointer is over `at`: bring the way there, if it can get there. */
      function reach(at) {
        const k = m.path.findIndex((p) => same(p, at));
        if (k >= 0) {
          if (k === m.path.length - 1) return false;
          m.path.length = k + 1;
          return true;
        }
        const way = route(m, head(), at);
        if (!way) return false;
        for (const d of way) extend(m, m.path, d);
        return true;
      }

      // A drag draws the way from its end. Pressing on the way somewhere
      // before its end and dragging off takes the way back to there first.
      let drag = null;
      let hold = 0;
      svg.addEventListener('contextmenu', (e) => e.preventDefault());
      svg.addEventListener('pointerdown', (e) => {
        const at = cellAt(e);
        if (!at) return;
        e.preventDefault();
        host.focus({ preventScroll: true });
        if (e.button === 2 || e.shiftKey) return note(at);
        if (e.button !== 0) return;
        drag = { from: at, moved: false };
        svg.setPointerCapture(e.pointerId);
        clearTimeout(hold);
        if (e.pointerType !== 'mouse') {
          // Held still on a touch screen: a pencil mark.
          hold = setTimeout(() => {
            if (drag && !drag.moved) { drag = null; note(at); }
          }, 500);
        }
        const k = m.path.findIndex((p) => same(p, at));
        if (k < 0 && !reach(at)) say('Start from the end of your line');
        else if (k < 0) commit();
      });
      svg.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const at = cellAt(e);
        if (!at || same(at, drag.last ?? drag.from)) return;
        drag.moved = true;
        clearTimeout(hold);
        if (!drag.last) reach(drag.from);
        drag.last = at;
        reach(at);
        draw();
      });
      const end = () => {
        clearTimeout(hold);
        if (drag?.moved) commit();
        drag = null;
      };
      svg.addEventListener('pointerup', end);
      svg.addEventListener('pointercancel', end);

      draw();
      return true;
    },
  }, `
.mz-grid {
  --cell: min(1.4rem, calc(92vw / var(--cols)));
  display: block; width: calc(var(--cell) * var(--cols)); height: auto;
  user-select: none; touch-action: none; cursor: crosshair;
  font-family: var(--gm-sans);
}
/* on a slide, leave room for the scripture above and the question below */
.deck .mz-grid { width: min(calc(var(--cell) * var(--cols)), calc(42vh * var(--cols) / var(--rows))); }
.mz-grid .paper { fill: var(--gm-paper, #fff); }
.mz-grid .wall { fill: none; stroke: var(--gm-ink, #222); stroke-width: 0.12; stroke-linecap: square; }
.mz-grid .way {
  fill: none; stroke: #2457a6; stroke-width: 0.34; stroke-linecap: round; stroke-linejoin: round; opacity: 0.75;
}
.mz-grid .head { fill: #2457a6; }
.mz-grid .note { fill: none; stroke: #8f8a82; stroke-width: 0.1; stroke-linecap: round; }
.mz-grid text { font-size: 0.75px; font-weight: 700; text-anchor: middle; }
.mz-grid .end-S { fill: #2e7d32; }
.mz-grid .end-E { fill: #c62828; }
.puzzle.solved .mz-grid .way { stroke: #2e7d32; }
.puzzle.solved .mz-grid .head { fill: #2e7d32; }
`);
})();
