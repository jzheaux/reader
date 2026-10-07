/**
 * Word search, played in the rendered page. See puzzles.js.
 *
 *   ```wordsearch
 *   E B E L I E V E X
 *   H O N E S T Q R P
 *   ...
 *   words: ABLE, BELIEVE, HOLY GHOST, HONEST
 *   found: BELIEVE r1c2-r1c8, HONEST r2c1-r2c6
 *   marks: NEST r2c3-r2c6
 *   ```
 *
 * The letters, a row to a line (spaces between them are for the eye), then
 * the words to find, then the ones found so far: each with the row and column
 * of its first and last letters. A word reads in a straight line, across,
 * down or diagonally, either way; spaces in a word aren't in the grid.
 *
 * Anything else circled is kept as a mark, ringed in gray: a word that isn't
 * on the list, or part of one that is. Its letters are written for the eye;
 * the squares are what count.
 */
(() => {
  const { owns } = Puzzles;

  const COLORS = ['#ffd54f', '#81d4fa', '#a5d6a7', '#f48fb1', '#ce93d8', '#ffab91', '#80cbc4', '#e6ee9c'];
  const key = (w) => w.toUpperCase().replace(/[^A-Z]/g, '');

  function parseWordsearch(text) {
    const rows = [];
    let words = null;
    let found = [];
    let marks = [];
    const entries = (list) => list.split(',')
      .map((x) => /^\s*(.*?)\s*r(\d+)c(\d+)\s*-\s*r(\d+)c(\d+)\s*$/.exec(x)).filter(Boolean)
      .map(([, word, r1, c1, r2, c2]) => ({ word: word.trim(), a: [r1 - 1, c1 - 1], b: [r2 - 1, c2 - 1] }));
    for (const row of text.split('\n')) {
      if (!row.trim()) continue;
      const w = /^\s*words\s*:(.*)$/i.exec(row);
      if (w) { words = w[1].split(',').map((x) => x.trim()).filter(Boolean); continue; }
      const f = /^\s*found\s*:(.*)$/i.exec(row);
      if (f) { found = entries(f[1]); continue; }
      const m = /^\s*marks\s*:(.*)$/i.exec(row);
      if (m) { marks = entries(m[1]); continue; }
      const letters = row.replace(/\s+/g, '');
      if (!/^[A-Za-z]+$/.test(letters)) return null;
      rows.push([...letters.toUpperCase()]);
    }
    if (!rows.length || !words?.length || rows.some((r) => r.length !== rows[0].length)) return null;
    const s = { grid: rows, R: rows.length, C: rows[0].length, words, found: [], marks: [] };
    // Keep only finds that really are a listed word, once each.
    for (const f of found) {
      const word = words.find((x) => key(x) === key(f.word));
      const cells = line(s, f.a, f.b);
      if (word && cells && spell(s, cells) === key(word) && !s.found.some((g) => g.word === word)) {
        s.found.push({ word, a: f.a, b: f.b });
      }
    }
    for (const m of marks) {
      if (line(s, m.a, m.b)?.length > 1) s.marks.push({ a: m.a, b: m.b });
    }
    return s;
  }

  function formatWordsearch(s) {
    const lines = s.grid.map((r) => r.join(' '));
    lines.push(`words: ${s.words.join(', ')}`);
    const cell = ([r, c]) => `r${r + 1}c${c + 1}`;
    if (s.found.length) lines.push(`found: ${s.found.map((f) => `${f.word} ${cell(f.a)}-${cell(f.b)}`).join(', ')}`);
    if (s.marks.length) {
      lines.push(`marks: ${s.marks.map((m) => `${spell(s, line(s, m.a, m.b))} ${cell(m.a)}-${cell(m.b)}`).join(', ')}`);
    }
    return lines.join('\n');
  }

  /** The squares from `a` to `b`, if they're in a straight line; else null. */
  function line({ R, C }, a, b) {
    const dr = b[0] - a[0];
    const dc = b[1] - a[1];
    if (dr && dc && Math.abs(dr) !== Math.abs(dc)) return null;
    const len = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
    const cells = [];
    for (let k = 0; k < len; k++) {
      const r = a[0] + Math.sign(dr) * k;
      const c = a[1] + Math.sign(dc) * k;
      if (r < 0 || r >= R || c < 0 || c >= C) return null;
      cells.push([r, c]);
    }
    return cells;
  }

  const spell = (s, cells) => cells.map(([r, c]) => s.grid[r][c]).join('');
  const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

  const WORDSEARCH_KEYS = [
    ['← → ↑ ↓', 'move'],
    ['Space or Enter', 'start a word, then again at its last letter'],
    ['drag', 'circle a word (or click its first and last letters)'],
    ['⌫', 'erase gray marks through this letter'],
    ['Esc', 'let go of a word; again, done for now'],
  ];

  const SVGNS = 'http://www.w3.org/2000/svg';
  function el(name, attrs = {}, text) {
    const e = document.createElementNS(SVGNS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  }

  Puzzles.register('wordsearch', {
    mount(host, text, ui, post) {
      const s = parseWordsearch(text);
      if (!s) return false;
      const { R, C } = s;
      let source = text;
      if (!ui.cursor || ui.cursor[0] >= R || ui.cursor[1] >= C) ui.cursor = [0, 0];
      ui.anchor = null;

      const board = document.createElement('div');
      board.className = 'ws';
      const svg = el('svg', { viewBox: `0 0 ${C} ${R}`, class: 'ws-grid', role: 'img' });
      svg.style.setProperty('--cols', C);
      svg.style.setProperty('--rows', R);
      const list = document.createElement('ul');
      list.className = `ws-words${s.words.length > 12 ? ' many' : ''}`;
      board.append(svg, list);
      const { bar, help } = Puzzles.frame(host, board, WORDSEARCH_KEYS);
      host.setAttribute('aria-label', 'Word search');

      let flash = '';
      let flashTimer = 0;
      function say(msg) {
        flash = msg;
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => { flash = ''; draw(); }, 1600);
      }

      const color = (i) => COLORS[i % COLORS.length];
      const mid = ([r, c]) => [c + 0.5, r + 0.5];

      function draw() {
        const parts = [el('rect', { x: 0, y: 0, width: C, height: R, class: 'paper' })];
        for (const m of s.marks) {
          const [x1, y1] = mid(m.a);
          const [x2, y2] = mid(m.b);
          parts.push(el('line', { x1, y1, x2, y2, class: 'mark' }));
        }
        s.found.forEach((f, i) => {
          const [x1, y1] = mid(f.a);
          const [x2, y2] = mid(f.b);
          parts.push(el('line', { x1, y1, x2, y2, class: 'ring', stroke: color(i) }));
        });
        const [cr, cc] = ui.cursor;
        parts.push(el('rect', { x: cc + 0.06, y: cr + 0.06, width: 0.88, height: 0.88, rx: 0.2, class: 'cursor' }));
        if (ui.anchor) {
          const ok = line(s, ui.anchor, ui.cursor);
          const [x1, y1] = mid(ui.anchor);
          const [x2, y2] = ok ? mid(ui.cursor) : mid(ui.anchor);
          parts.push(el('line', { x1, y1, x2, y2, class: `pick${ok ? '' : ' bent'}` }));
        }
        for (let r = 0; r < R; r++) {
          for (let c = 0; c < C; c++) parts.push(el('text', { x: c + 0.5, y: r + 0.71 }, s.grid[r][c]));
        }
        parts.push(el('rect', { x: 0, y: 0, width: C, height: R, class: 'frame' }));
        svg.replaceChildren(...parts);

        list.replaceChildren(...s.words.map((w) => {
          const li = document.createElement('li');
          const i = s.found.findIndex((f) => f.word === w);
          li.textContent = w;
          if (i >= 0) {
            li.className = 'found';
            li.style.setProperty('--ring', color(i));
          }
          return li;
        }));

        const done = s.found.length === s.words.length;
        host.classList.toggle('solved', done);
        bar.textContent = done
          ? 'All found! 🎉'
          : flash || `${s.found.length} of ${s.words.length} found · ? for keys`;
        help.hidden = !ui.help;
      }

      function commit() {
        const after = formatWordsearch(s);
        if (after !== source) post(source, after);
        source = after;
        draw();
      }

      /** The squares from `a` to `b` were circled: keep them if they spell a word. */
      function circle(a, b) {
        ui.anchor = null;
        const cells = line(s, a, b);
        if (!cells || cells.length < 2) {
          if (cells?.length !== 1) say('Words go in a straight line');
          return draw();
        }
        const letters = spell(s, cells);
        const back = [...letters].reverse().join('');
        const word = s.words.find((w) => key(w) === letters || key(w) === back);
        if (!word) {
          // Not on the list: a gray mark, or, circled again, no mark.
          const k = s.marks.findIndex((m) => (same(m.a, a) && same(m.b, b)) || (same(m.a, b) && same(m.b, a)));
          if (k >= 0) {
            s.marks.splice(k, 1);
            say(`Erased ${letters}`);
          } else {
            s.marks.push({ a, b });
            say(`${letters} isn't on the list, so it's marked in gray`);
          }
          return commit();
        }
        if (s.found.some((f) => f.word === word)) { say(`Already found ${word}`); return draw(); }
        // Store it the way it reads. Gray marks inside it are part of it now.
        s.found.push(key(word) === letters ? { word, a, b } : { word, a: b, b: a });
        const inside = new Set(cells.map(String));
        s.marks = s.marks.filter((m) => !line(s, m.a, m.b).every((c) => inside.has(String(c))));
        flash = '';
        commit();
      }

      const ARROWS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      host.addEventListener('keydown', (e) => {
        if (!owns(e)) return;
        e.preventDefault();
        e.stopPropagation();
        const d = ARROWS[e.key];
        if (d) {
          ui.cursor = [
            Math.min(R - 1, Math.max(0, ui.cursor[0] + d[0])),
            Math.min(C - 1, Math.max(0, ui.cursor[1] + d[1])),
          ];
          return draw();
        }
        switch (e.key) {
          case ' ': case 'Enter':
            // A word started here ends here; one started with a click (that
            // may only have been a click to start playing) starts over.
            if (ui.anchor && ui.anchorByKey) return circle(ui.anchor, ui.cursor);
            ui.anchor = [...ui.cursor];
            ui.anchorByKey = true;
            return draw();
          case 'Backspace': case 'Delete': {
            const at = String(ui.cursor);
            const before = s.marks.length;
            s.marks = s.marks.filter((m) => !line(s, m.a, m.b).some((c) => String(c) === at));
            if (s.marks.length < before) say('Erased');
            return commit();
          }
          case '?': ui.help = !ui.help; return draw();
          case 'Escape':
            if (ui.anchor) { ui.anchor = null; return draw(); }
            return host.blur();
          default:
        }
      });

      const square = (e) => {
        const box = svg.getBoundingClientRect();
        const c = Math.floor(((e.clientX - box.left) / box.width) * C);
        const r = Math.floor(((e.clientY - box.top) / box.height) * R);
        return r >= 0 && r < R && c >= 0 && c < C ? [r, c] : null;
      };
      let dragging = false;
      svg.addEventListener('pointerdown', (e) => {
        const at = square(e);
        if (!at) return;
        e.preventDefault();
        host.focus({ preventScroll: true });
        ui.cursor = at;
        // A second click, at a word's other end, circles it.
        if (ui.anchor && !same(ui.anchor, at)) return circle(ui.anchor, at);
        ui.anchor = at;
        ui.anchorByKey = false;
        dragging = true;
        svg.setPointerCapture(e.pointerId);
        draw();
      });
      svg.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const at = square(e);
        if (!at || same(at, ui.cursor)) return;
        ui.cursor = at;
        draw();
      });
      svg.addEventListener('pointerup', (e) => {
        if (!dragging) return;
        dragging = false;
        const at = square(e);
        if (at && ui.anchor && !same(at, ui.anchor)) circle(ui.anchor, at);
      });
      svg.addEventListener('pointercancel', () => { dragging = false; });

      draw();
      return true;
    },
  }, `
.ws { display: flex; flex-wrap: wrap; gap: 0.6rem 1.4rem; align-items: flex-start; }
.ws-grid {
  --cell: min(1.9rem, calc(92vw / var(--cols)));
  display: block; width: calc(var(--cell) * var(--cols)); height: auto;
  user-select: none; touch-action: none; cursor: pointer;
  font-family: var(--gm-sans);
}
/* on a slide, leave room for the scripture above and the question below */
.deck .ws-grid { width: min(calc(var(--cell) * var(--cols)), calc(32vh * var(--cols) / var(--rows))); }
.ws-grid .paper { fill: var(--gm-paper, #fff); }
.ws-grid .frame { fill: none; stroke: var(--gm-ink, #222); stroke-width: 0.06; }
.ws-grid text { font-size: 0.6px; font-weight: 600; text-anchor: middle; fill: var(--gm-ink, #222); }
.ws-grid .ring { stroke-width: 0.72; stroke-linecap: round; opacity: 0.6; }
.ws-grid .mark { stroke: #b9b5ad; stroke-width: 0.6; stroke-linecap: round; opacity: 0.45; }
.ws-grid .pick { stroke: #2457a6; stroke-width: 0.72; stroke-linecap: round; opacity: 0.3; }
.ws-grid .pick.bent { stroke: #9e9a93; }
.ws-grid .cursor { fill: none; stroke: transparent; stroke-width: 0.07; }
.puzzle:focus-within .ws-grid .cursor { stroke: #2457a6; }
.ws-words {
  list-style: none; margin: 0; padding: 0;
  font-family: var(--gm-sans); font-size: 0.85rem; line-height: 1.6;
}
.ws-words.many { columns: 2; column-gap: 1.4rem; }
.deck .ws-words { font-size: 0.6rem; line-height: 1.45; }
.deck .ws-words.many { columns: 3; }
.ws-words li { break-inside: avoid; white-space: nowrap; }
.ws-words li::before {
  content: ""; display: inline-block; width: 0.7em; height: 0.7em; margin-right: 0.45em;
  border: 1.5px solid #9e9a93; border-radius: 2px; vertical-align: -0.05em;
}
.ws-words li.found { color: var(--gm-ink-soft, #777); text-decoration: line-through; }
.ws-words li.found::before { background: var(--ring); border-color: var(--ring); }
.puzzle.solved .ws-grid .frame { stroke: #2e7d32; }
`);
})();
