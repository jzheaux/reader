/**
 * Train tracks, played in the rendered page. See puzzles.js.
 *
 *   ```tracks
 *   2 2 8 8 8 6 5 0
 *   · · · · · · ━ ·  5
 *   ━ ─ ┐ ┗ · · · ·  7
 *   · · │ × · · · ·  6
 *   ...
 *   A: left 2  B: bottom 5
 *   ```
 *
 * One track runs from A to B through the grid, never branching or crossing
 * itself; the numbers along the top and down the right say how many squares
 * in each column and row it passes through. A and B name the edge the track
 * enters and leaves by, and the row or column, counting from 1.
 *
 * Each square is drawn as the track in it: heavy lines (━ ┃ ┏ ┓ ┗ ┛) for the
 * pieces given, light ones (─ │ ┌ ┐ └ ┘) for what's been laid, a half line
 * (╴ ╵ ╶ ╷) for track laid into a square but not yet out of it, × for a
 * square marked as having no track, and · for one not yet decided.
 */
(() => {
  const { owns } = Puzzles;

  // Directions as bits: north, east, south, west.
  const N = 1, E = 2, S = 4, W = 8;
  const DIRS = [N, E, S, W];
  const STEP = { [N]: [-1, 0], [E]: [0, 1], [S]: [1, 0], [W]: [0, -1] };
  const OPP = { [N]: S, [E]: W, [S]: N, [W]: E };
  const OUTWARD = { left: W, right: E, top: N, bottom: S };

  const LIGHT = {
    0: '·', [E | W]: '─', [N | S]: '│', [S | E]: '┌', [S | W]: '┐', [N | E]: '└', [N | W]: '┘',
    [W]: '╴', [N]: '╵', [E]: '╶', [S]: '╷',
  };
  const HEAVY = { [E | W]: '━', [N | S]: '┃', [S | E]: '┏', [S | W]: '┓', [N | E]: '┗', [N | W]: '┛' };
  const GLYPH = new Map([
    ...Object.entries(LIGHT).map(([m, g]) => [g, { mine: Number(m) }]),
    ...Object.entries(HEAVY).map(([m, g]) => [g, { given: Number(m) }]),
    ['.', { mine: 0 }], ['×', { cross: true }], ['x', { cross: true }], ['X', { cross: true }],
  ]);

  const bits = (m) => DIRS.filter((d) => m & d);

  function parseTracks(text) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const ends = {};
    let cols = null;
    const grid = [];
    for (const line of lines) {
      const found = [...line.matchAll(/\b([AB])\s*:\s*(left|right|top|bottom)\s+(\d+)/gi)];
      if (found.length) {
        for (const [, ab, edge, k] of found) ends[ab.toUpperCase()] = { edge: edge.toLowerCase(), k: Number(k) };
        continue;
      }
      const tokens = line.split(/\s+/);
      if (!cols) {
        if (tokens.every((t) => /^\d+$/.test(t))) cols = tokens.map(Number);
        continue;
      }
      if (tokens.length !== cols.length + 1 || !/^\d+$/.test(tokens.at(-1))) return null;
      const cells = tokens.slice(0, -1).map((t) => GLYPH.get(t));
      if (cells.some((c) => !c)) return null;
      grid.push({ cells, clue: Number(tokens.at(-1)) });
    }
    const n = cols?.length;
    if (!n || grid.length !== n || !ends.A || !ends.B) return null;
    const s = {
      n, cols, rows: grid.map((g) => g.clue), ends,
      given: grid.flatMap((g) => g.cells.map((c) => c.given ?? 0)),
      mine: grid.flatMap((g) => g.cells.map((c) => c.mine ?? 0)),
      cross: grid.flatMap((g) => g.cells.map((c) => Boolean(c.cross))),
    };
    for (const ab of ['A', 'B']) {
      const end = endpoint(s, ab);
      if (!end) return null;
      ends[ab] = { ...ends[ab], ...end };
    }
    return s;
  }

  /** The square an end of the track is in, and its way out of the grid. */
  function endpoint({ n, ends }, ab) {
    const { edge, k } = ends[ab];
    if (!(k >= 1 && k <= n)) return null;
    const [r, c] = { left: [k - 1, 0], right: [k - 1, n - 1], top: [0, k - 1], bottom: [n - 1, k - 1] }[edge];
    return { cell: r * n + c, out: OUTWARD[edge] };
  }

  function formatTracks(s) {
    const { n } = s;
    const lines = [s.cols.join(' ')];
    for (let r = 0; r < n; r++) {
      const cells = [];
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        cells.push(s.given[i] ? HEAVY[s.given[i]] : s.cross[i] ? '×' : LIGHT[s.mine[i]]);
      }
      lines.push(`${cells.join(' ')}  ${s.rows[r]}`);
    }
    const { A, B } = s.ends;
    lines.push(`A: ${A.edge} ${A.k}  B: ${B.edge} ${B.k}`);
    return lines.join('\n');
  }

  const TRACKS_KEYS = [
    ['← → ↑ ↓', 'move'],
    ['⇧ + arrow', 'lay track that way (again to pick it up)'],
    ['drag', 'lay track with the mouse'],
    ['x', 'mark a square with no track'],
    ['⌫', 'clear a square'],
    ['Esc', 'done for now'],
  ];

  const SVGNS = 'http://www.w3.org/2000/svg';
  function el(name, attrs = {}, text) {
    const e = document.createElementNS(SVGNS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  }

  Puzzles.register('tracks', {
    mount(host, text, ui, post) {
      const s = parseTracks(text);
      if (!s) return false;
      const { n } = s;
      let source = text;
      if (ui.cursor == null || ui.cursor >= n * n) ui.cursor = s.ends.A.cell;

      const at = (i) => s.given[i] || s.mine[i];
      const neighbor = (i, d) => {
        const r = Math.floor(i / n) + STEP[d][0];
        const c = (i % n) + STEP[d][1];
        return r >= 0 && r < n && c >= 0 && c < n ? r * n + c : -1;
      };
      const isExit = (i, d) => ['A', 'B'].some((ab) => s.ends[ab].cell === i && s.ends[ab].out === d);

      /** Can square `i` take track toward `d`? */
      const open = (i, d) => (s.given[i]
        ? Boolean(s.given[i] & d)
        : !s.cross[i] && (Boolean(s.mine[i] & d) || bits(s.mine[i]).length < 2));

      /**
       * Lays track from square `i` toward `d`, or picks it up if it's already
       * there. 'blocked' if it can't go that way.
       */
      function lay(i, d) {
        const j = neighbor(i, d);
        if (j < 0) {
          if (!isExit(i, d) || s.given[i]) return 'blocked';
          if (s.mine[i] & d) { s.mine[i] &= ~d; return 'removed'; }
          if (!open(i, d)) return 'blocked';
          s.mine[i] |= d;
          return 'added';
        }
        const back = OPP[d];
        if ((at(i) & d) && (at(j) & back)) {
          if (s.given[i] && s.given[j]) return 'blocked';
          if (!s.given[i]) s.mine[i] &= ~d;
          if (!s.given[j]) s.mine[j] &= ~back;
          return 'removed';
        }
        if (!open(i, d) || !open(j, back)) return 'blocked';
        if (!s.given[i]) s.mine[i] |= d;
        if (!s.given[j]) s.mine[j] |= back;
        return 'added';
      }

      function clear(i) {
        if (s.given[i]) return;
        for (const d of bits(s.mine[i])) {
          const j = neighbor(i, d);
          if (j >= 0 && !s.given[j]) s.mine[j] &= ~OPP[d];
        }
        s.mine[i] = 0;
        s.cross[i] = false;
      }

      /** One track from A out through B, through every square with track. */
      function solved(counts) {
        if (counts.rows.some((k, r) => k !== s.rows[r]) || counts.cols.some((k, c) => k !== s.cols[c])) return false;
        const { A, B } = s.ends;
        const seen = new Set();
        let cur = A.cell;
        let came = A.out;
        for (;;) {
          const m = at(cur);
          if (!(m & came) || bits(m).length !== 2 || seen.has(cur)) return false;
          seen.add(cur);
          const out = m & ~came;
          if (cur === B.cell && out === B.out) break;
          const next = neighbor(cur, out);
          if (next < 0 || !(at(next) & OPP[out])) return false;
          came = OPP[out];
          cur = next;
        }
        return seen.size === counts.total;
      }

      const svg = el('svg', { viewBox: `0 0 ${n + 2} ${n + 2}`, class: 'tracks-board', role: 'img' });
      svg.style.setProperty('--span', n + 2);
      const { bar, help } = Puzzles.frame(host, svg, TRACKS_KEYS);
      host.setAttribute('aria-label', 'Train tracks');

      /** Where track in square `i` reaches toward `d`: its edge, or past it out of the grid. */
      function reach(i, d) {
        const r = Math.floor(i / n) + 1.5;
        const c = (i % n) + 1.5;
        const k = isExit(i, d) ? 0.85 : 0.5;
        return [c + STEP[d][1] * k, r + STEP[d][0] * k];
      }

      function piece(i, m, cls) {
        const r = Math.floor(i / n) + 1.5;
        const c = (i % n) + 1.5;
        const ds = bits(m);
        let d;
        if (ds.length === 1) {
          const [x, y] = reach(i, ds[0]);
          d = `M${c} ${r}L${x} ${y}`;
        } else {
          const [x1, y1] = reach(i, ds[0]);
          const [x2, y2] = reach(i, ds[1]);
          d = OPP[ds[0]] === ds[1] ? `M${x1} ${y1}L${x2} ${y2}` : `M${x1} ${y1}Q${c} ${r} ${x2} ${y2}`;
        }
        return el('path', { d, class: cls });
      }

      function draw() {
        const counts = { rows: Array(n).fill(0), cols: Array(n).fill(0), total: 0 };
        for (let i = 0; i < n * n; i++) {
          if (!at(i)) continue;
          counts.rows[Math.floor(i / n)]++;
          counts.cols[i % n]++;
          counts.total++;
        }
        const done = solved(counts);
        const parts = [el('rect', { x: 1, y: 1, width: n, height: n, class: 'board' })];
        const cr = Math.floor(ui.cursor / n);
        const cc = ui.cursor % n;
        parts.push(el('rect', { x: cc + 1, y: cr + 1, width: 1, height: 1, class: 'cursor' }));
        for (let k = 1; k < n; k++) {
          parts.push(el('line', { x1: 1, y1: k + 1, x2: n + 1, y2: k + 1, class: 'rule' }));
          parts.push(el('line', { x1: k + 1, y1: 1, x2: k + 1, y2: n + 1, class: 'rule' }));
        }
        parts.push(el('rect', { x: 1, y: 1, width: n, height: n, class: 'frame' }));
        const state = (have, want) => (have === want ? 'clue met' : have > want ? 'clue over' : 'clue');
        for (let k = 0; k < n; k++) {
          parts.push(el('text', { x: k + 1.5, y: 0.72, class: state(counts.cols[k], s.cols[k]) }, s.cols[k]));
          parts.push(el('text', { x: n + 1.5, y: k + 1.72, class: state(counts.rows[k], s.rows[k]) }, s.rows[k]));
        }
        for (const ab of ['A', 'B']) {
          const { cell, out } = s.ends[ab];
          const [x, y] = reach(cell, out);
          const lx = x + STEP[out][1] * 0.42;
          const ly = y + STEP[out][0] * 0.42 + 0.17;
          parts.push(el('text', { x: lx, y: ly, class: `end end-${ab.toLowerCase()}` }, ab));
        }
        for (let i = 0; i < n * n; i++) {
          if (s.given[i]) parts.push(piece(i, s.given[i], 'track given'));
          else if (s.mine[i]) parts.push(piece(i, s.mine[i], 'track mine'));
          else if (s.cross[i]) {
            const x = (i % n) + 1.5;
            const y = Math.floor(i / n) + 1.5;
            parts.push(el('path', { d: `M${x - 0.15} ${y - 0.15}L${x + 0.15} ${y + 0.15}M${x + 0.15} ${y - 0.15}L${x - 0.15} ${y + 0.15}`, class: 'cross' }));
          }
        }
        svg.replaceChildren(...parts);
        host.classList.toggle('solved', done);
        bar.textContent = done
          ? 'Solved! 🎉'
          : `${counts.total} of ${s.rows.reduce((a, b) => a + b, 0)} squares of track · ? for keys`;
        help.hidden = !ui.help;
      }

      function commit() {
        const after = formatTracks(s);
        if (after !== source) post(source, after);
        source = after;
        draw();
      }

      const ARROWS = { ArrowUp: N, ArrowRight: E, ArrowDown: S, ArrowLeft: W };
      host.addEventListener('keydown', (e) => {
        if (!owns(e)) return;
        e.preventDefault();
        e.stopPropagation();
        const d = ARROWS[e.key];
        if (d) {
          const j = neighbor(ui.cursor, d);
          if (e.shiftKey) {
            if (lay(ui.cursor, d) !== 'blocked' && j >= 0) ui.cursor = j;
            return commit();
          }
          if (j >= 0) ui.cursor = j;
          return draw();
        }
        switch (e.key) {
          case 'x': case 'X':
            if (!s.given[ui.cursor] && !s.mine[ui.cursor]) s.cross[ui.cursor] = !s.cross[ui.cursor];
            return commit();
          case 'Backspace': case 'Delete': case ' ': clear(ui.cursor); return commit();
          case '?': ui.help = !ui.help; return draw();
          case 'Escape': return host.blur();
          default:
        }
      });

      // Dragging lays track square by square; dragging back picks it up.
      const square = (e) => {
        const box = svg.getBoundingClientRect();
        const x = Math.floor(((e.clientX - box.left) / box.width) * (n + 2)) - 1;
        const y = Math.floor(((e.clientY - box.top) / box.height) * (n + 2)) - 1;
        return x >= 0 && x < n && y >= 0 && y < n ? y * n + x : -1;
      };
      let drag = null;
      svg.addEventListener('pointerdown', (e) => {
        const i = square(e);
        if (i < 0) return;
        e.preventDefault();
        host.focus({ preventScroll: true });
        ui.cursor = i;
        drag = i;
        svg.setPointerCapture(e.pointerId);
        draw();
      });
      svg.addEventListener('pointermove', (e) => {
        if (drag == null) return;
        const i = square(e);
        if (i < 0 || i === drag) return;
        let moved = false;
        // A quick drag can skip squares; walk to it along a row or column.
        while (drag !== i) {
          const dr = Math.sign(Math.floor(i / n) - Math.floor(drag / n));
          const dc = Math.sign((i % n) - (drag % n));
          if (dr && dc) break;
          const d = dr < 0 ? N : dr > 0 ? S : dc > 0 ? E : W;
          if (lay(drag, d) === 'blocked') break;
          drag = neighbor(drag, d);
          moved = true;
        }
        if (!moved) return;
        ui.cursor = drag;
        commit();
      });
      const stop = () => { drag = null; };
      svg.addEventListener('pointerup', stop);
      svg.addEventListener('pointercancel', stop);
      svg.addEventListener('dblclick', (e) => {
        const i = square(e);
        if (i < 0 || s.given[i] || s.mine[i]) return;
        s.cross[i] = !s.cross[i];
        commit();
      });

      draw();
      return true;
    },
  }, `
.tracks-board {
  --cell: min(2.4rem, 8vw);
  display: block; width: calc(var(--cell) * var(--span)); height: auto;
  user-select: none; touch-action: none; cursor: pointer;
  font-family: var(--gm-sans);
}
/* on a slide, leave room for the scripture above and the question below */
.deck .tracks-board { width: min(calc(5.6vh * var(--span)), 36vh); }
.tracks-board .board { fill: var(--gm-paper, #fff); }
.tracks-board .rule { stroke: #c9c5bd; stroke-width: 0.025; }
.tracks-board .frame { fill: none; stroke: var(--gm-ink, #222); stroke-width: 0.07; }
.tracks-board .cursor { fill: transparent; }
.puzzle:focus-within .tracks-board .cursor { fill: #c9daf5; }
.tracks-board text { font-size: 0.55px; text-anchor: middle; fill: var(--gm-ink, #222); font-weight: 600; }
.tracks-board .clue.met { fill: #2e7d32; }
.tracks-board .clue.over { fill: #c62828; }
.tracks-board .end { font-size: 0.5px; font-weight: 700; }
.tracks-board .end-a { fill: #27ae60; }
.tracks-board .end-b { fill: #c0392b; }
.tracks-board .track { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.tracks-board .given { stroke: #5d4037; stroke-width: 0.24; }
.tracks-board .mine { stroke: #2457a6; stroke-width: 0.18; }
.tracks-board .cross { stroke: #9e9a93; stroke-width: 0.06; stroke-linecap: round; }
.puzzle.solved .tracks-board .frame { stroke: #2e7d32; }
.puzzle.solved .tracks-board .mine { stroke: #2e7d32; }
@media print { .tracks-board .cursor { fill: transparent !important; } }
`);
})();
