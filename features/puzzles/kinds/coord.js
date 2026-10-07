/**
 * Coordinate graph mystery picture, played in the rendered page. See ../preview.js.
 *
 *   ```coord
 *   grid: 20 x 24
 *   (3, 1) (17, 1) (17, 9) (3, 9) (3, 1)
 *   (2, 9) (18, 9) (17, 10) (3, 10) (2, 9)
 *   ...
 *   plotted: 7
 *   ```
 *
 * The grid's width and height, then the points to plot, one pencil stroke to
 * a line: start at the first, draw to each in turn, and lift the pencil at
 * the end of the line. `plotted` is how many points, counting through the
 * lines in order, have been plotted so far.
 */
(() => {
  const { owns } = Puzzles;

  function parseCoord(text) {
    let size = null;
    let plotted = 0;
    const strokes = [];
    for (const row of text.split('\n')) {
      if (!row.trim()) continue;
      const g = /^\s*grid\s*:\s*(\d+)\s*[x×]\s*(\d+)\s*$/i.exec(row);
      if (g) { size = [Number(g[1]), Number(g[2])]; continue; }
      const p = /^\s*plotted\s*:\s*(\d+)\s*$/i.exec(row);
      if (p) { plotted = Number(p[1]); continue; }
      const points = [...row.matchAll(/\(\s*(\d+)\s*,\s*(\d+)\s*\)/g)].map(([, x, y]) => [Number(x), Number(y)]);
      if (!points.length || row.replace(/\(\s*\d+\s*,\s*\d+\s*\)/g, '').trim()) return null;
      strokes.push(points);
    }
    if (!size || !strokes.length) return null;
    const [W, H] = size;
    if (strokes.flat().some(([x, y]) => x > W || y > H)) return null;
    const total = strokes.reduce((n, st) => n + st.length, 0);
    return { W, H, strokes, total, plotted: Math.min(total, plotted) };
  }

  function formatCoord(s) {
    return [
      `grid: ${s.W} x ${s.H}`,
      ...s.strokes.map((st) => st.map(([x, y]) => `(${x}, ${y})`).join(' ')),
      `plotted: ${s.plotted}`,
    ].join('\n');
  }

  /** The `k`-th point overall: its stroke, its place in it, and where it is. */
  function nth(s, k) {
    for (let i = 0; i < s.strokes.length; i++) {
      if (k < s.strokes[i].length) return { stroke: i, at: k, point: s.strokes[i][k] };
      k -= s.strokes[i].length;
    }
    return null;
  }

  /** Every point plotted: the picture is complete. */
  const isComplete = (s) => s.plotted === s.total;

  const COORD_KEYS = [
    ['← → ↑ ↓', 'move the pencil (with ⇧, five at a time)'],
    ['Space or Enter', 'plot the next point here'],
    ['click', 'plot the next point there'],
    ['⌫', 'take back the last point'],
    ['Esc', 'done for now'],
  ];

  const SVGNS = 'http://www.w3.org/2000/svg';
  function el(name, attrs = {}, text) {
    const e = document.createElementNS(SVGNS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  }

  Puzzles.register('coord', {
    parse: parseCoord,
    format: formatCoord,
    solved: isComplete,
    rules: { nth },
    mount(host, text, ui, post) {
      const s = parseCoord(text);
      if (!s) return false;
      const { W, H } = s;
      let source = text;
      if (!ui.at || ui.at[0] > W || ui.at[1] > H) ui.at = [0, 0];
      ui.miss = null;

      const board = document.createElement('div');
      board.className = 'coord';
      // Room around the grid for the numbers along the axes.
      const L = 1.5, B = 1.4, T = 0.6, R = 0.9;
      const svg = el('svg', { viewBox: `${-L} ${-T} ${W + L + R} ${H + T + B}`, class: 'coord-graph', role: 'img' });
      svg.style.setProperty('--w', W + L + R);
      svg.style.setProperty('--h', H + T + B);
      const list = document.createElement('div');
      list.className = 'coord-list';
      board.append(svg, list);
      const { bar, help } = Puzzles.frame(host, board, COORD_KEYS);
      host.setAttribute('aria-label', 'Coordinate graph');

      let flash = '';
      let flashTimer = 0;
      function say(msg) {
        flash = msg;
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => { flash = ''; ui.miss = null; draw(); }, 1800);
      }

      const X = (x) => x;
      const Y = (y) => H - y;

      function draw() {
        const parts = [el('rect', { x: 0, y: 0, width: W, height: H, class: 'paper' })];
        for (let i = 1; i < W; i++) {
          parts.push(el('line', { x1: i, y1: 0, x2: i, y2: H, class: i % 5 ? 'rule' : 'rule major' }));
        }
        for (let j = 1; j < H; j++) {
          parts.push(el('line', { x1: 0, y1: Y(j), x2: W, y2: Y(j), class: j % 5 ? 'rule' : 'rule major' }));
        }
        parts.push(el('path', { d: `M0 0V${H}H${W}`, class: 'axis' }));
        parts.push(el('path', { d: `M0 0H${W}V${H}`, class: 'edge' }));
        const [ax, ay] = ui.at;
        for (let i = 0; i <= W; i++) {
          parts.push(el('text', { x: X(i), y: H + 0.85, class: `num${i === ax ? ' hot' : ''}` }, i));
        }
        for (let j = 0; j <= H; j++) {
          parts.push(el('text', { x: -0.35, y: Y(j) + 0.17, class: `num y${j === ay ? ' hot' : ''}` }, j));
        }
        parts.push(el('text', { x: W + 0.45, y: H + 0.2, class: 'axis-name' }, 'x'));
        parts.push(el('text', { x: 0, y: -0.18, class: 'axis-name' }, 'y'));

        // Where the pencil is, traced to both axes.
        parts.push(el('path', { d: `M${X(ax)} ${Y(ay)}V${H}M${X(ax)} ${Y(ay)}H0`, class: 'guide' }));

        // What's been drawn: each stroke as far as it's gone.
        let left = s.plotted;
        for (const st of s.strokes) {
          if (left <= 0) break;
          const done = st.slice(0, left);
          left -= done.length;
          if (done.length > 1) {
            parts.push(el('polyline', { points: done.map(([x, y]) => `${X(x)},${Y(y)}`).join(' '), class: 'pen' }));
          }
          for (const [x, y] of done) parts.push(el('circle', { cx: X(x), cy: Y(y), r: 0.11, class: 'dot' }));
        }
        if (ui.miss) parts.push(el('circle', { cx: X(ui.miss[0]), cy: Y(ui.miss[1]), r: 0.16, class: 'miss' }));
        parts.push(el('circle', { cx: X(ax), cy: Y(ay), r: 0.22, class: 'pencil' }));
        svg.replaceChildren(...parts);

        // The list, as on paper: START, the points, STOP.
        const next = nth(s, s.plotted);
        let k = 0;
        list.replaceChildren(...s.strokes.map((st) => {
          const ol = document.createElement('ol');
          const item = (txt, cls) => {
            const li = document.createElement('li');
            li.textContent = txt;
            li.className = cls;
            ol.append(li);
          };
          item('START', 'cue');
          for (const [x, y] of st) {
            item(`(${x}, ${y})`, k < s.plotted ? 'done' : k === s.plotted ? 'next' : '');
            k++;
          }
          item('STOP', 'cue');
          return ol;
        }));

        const complete = isComplete(s);
        host.classList.toggle('solved', complete);
        bar.textContent = complete
          ? 'Picture complete! 🎉'
          : flash || `Next: (${next.point[0]}, ${next.point[1]})${next.at === 0 ? ', a new START' : ''} · ${s.plotted} of ${s.total} · ? for keys`;
        help.hidden = !ui.help;
      }

      function commit() {
        const after = formatCoord(s);
        if (after !== source) post(source, after);
        source = after;
        draw();
      }

      function plot() {
        const next = nth(s, s.plotted);
        if (!next) return;
        const [x, y] = next.point;
        if (ui.at[0] !== x || ui.at[1] !== y) {
          ui.miss = [...ui.at];
          say(`Not quite: that's not (${x}, ${y})`);
          return draw();
        }
        ui.miss = null;
        s.plotted++;
        flash = '';
        if (next.at === s.strokes[next.stroke].length - 1 && s.plotted < s.total) say('STOP: lift your pencil');
        commit();
      }

      function move(dx, dy) {
        ui.at = [Math.min(W, Math.max(0, ui.at[0] + dx)), Math.min(H, Math.max(0, ui.at[1] + dy))];
        draw();
      }

      host.addEventListener('keydown', (e) => {
        if (!owns(e)) return;
        e.preventDefault();
        e.stopPropagation();
        const k = e.shiftKey ? 5 : 1;
        switch (e.key) {
          case 'ArrowUp': return move(0, k);
          case 'ArrowDown': return move(0, -k);
          case 'ArrowLeft': return move(-k, 0);
          case 'ArrowRight': return move(k, 0);
          case ' ': case 'Enter': return plot();
          case 'Backspace': case 'Delete':
            if (s.plotted) { s.plotted--; flash = ''; commit(); }
            return undefined;
          case '?': ui.help = !ui.help; return draw();
          case 'Escape': return host.blur();
          default:
        }
      });

      /** The grid point nearest the mouse. */
      const point = (e) => {
        const box = svg.getBoundingClientRect();
        const u = box.width / (W + L + R);
        const x = Math.round((e.clientX - box.left) / u - L);
        const y = H - Math.round((e.clientY - box.top) / u - T);
        return x >= 0 && x <= W && y >= 0 && y <= H ? [x, y] : null;
      };
      svg.addEventListener('pointermove', (e) => {
        if (!host.contains(document.activeElement)) return;
        const at = point(e);
        if (!at || (at[0] === ui.at[0] && at[1] === ui.at[1])) return;
        ui.at = at;
        draw();
      });
      svg.addEventListener('pointerdown', (e) => {
        const at = point(e);
        if (!at) return;
        e.preventDefault();
        host.focus({ preventScroll: true });
        ui.at = at;
        plot();
      });

      draw();
      return true;
    },
  }, `
.coord { display: flex; flex-wrap: wrap; gap: 0.8rem 1.4rem; align-items: flex-start; }
.coord-graph {
  --unit: min(1.25rem, calc(92vw / var(--w)));
  display: block; width: calc(var(--unit) * var(--w)); height: auto;
  user-select: none; touch-action: none; cursor: crosshair;
  font-family: var(--gm-sans);
}
/* on a slide, leave room for the scripture above and the question below */
.deck .coord-graph { width: min(calc(var(--unit) * var(--w)), calc(42vh * var(--w) / var(--h))); }
.coord-graph .paper { fill: var(--gm-paper, #fff); }
.coord-graph .rule { stroke: #dedad3; stroke-width: 0.04; }
.coord-graph .rule.major { stroke: #b9b5ad; }
.coord-graph .axis { fill: none; stroke: var(--gm-ink, #222); stroke-width: 0.09; }
.coord-graph .edge { fill: none; stroke: #b9b5ad; stroke-width: 0.04; }
.coord-graph text { font-size: 0.42px; fill: var(--gm-ink-soft, #777); text-anchor: middle; }
.coord-graph text.y { text-anchor: end; }
.coord-graph .axis-name { font-size: 0.55px; font-weight: 700; fill: var(--gm-ink, #222); }
.puzzle:focus-within .coord-graph .num.hot { fill: #2457a6; font-weight: 700; font-size: 0.55px; }
.coord-graph .guide { fill: none; stroke: transparent; stroke-width: 0.06; stroke-dasharray: 0.15 0.15; }
.puzzle:focus-within .coord-graph .guide { stroke: #8fb0e3; }
.coord-graph .pen { fill: none; stroke: #1a5276; stroke-width: 0.16; stroke-linecap: round; stroke-linejoin: round; }
.coord-graph .dot { fill: #1a5276; }
.coord-graph .miss { fill: #c62828; opacity: 0.55; }
.coord-graph .pencil { fill: none; stroke: transparent; stroke-width: 0.07; }
.puzzle:focus-within .coord-graph .pencil { stroke: #2457a6; }
.coord-list {
  flex: 1 1 14rem; columns: 5.4em auto; column-gap: 1em;
  font-family: var(--gm-sans); font-size: 0.78rem; line-height: 1.45;
}
.deck .coord-list { font-size: 0.5rem; }
.coord-list ol { list-style: none; margin: 0; padding: 0; }
.coord-list li { white-space: nowrap; break-inside: avoid; }
.coord-list li.cue { font-weight: 700; color: #1a5276; font-size: 0.85em; letter-spacing: 0.04em; }
.coord-list li.done { color: var(--gm-ink-soft, #999); text-decoration: line-through; }
.coord-list li.next { font-weight: 700; color: #2457a6; }
.coord-list li.next::before { content: "▸ "; }
.puzzle.solved .coord-graph .pen { stroke: #2e7d32; }
.puzzle.solved .coord-graph .dot { fill: #2e7d32; }
@media print { .coord-graph .guide, .coord-graph .pencil { stroke: transparent !important; } }
`);
})();
