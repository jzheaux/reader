/**
 * Draws a line from each mark to each aside about it, in the aside's
 * colour, as a pen would across the margin; hovering either one picks out
 * both, and the line. Lines are drawn again whenever what they join may
 * have moved: a render, the page or a slide changing size, a step showing,
 * the fonts arriving, and just before printing. An aside that isn't beside
 * its words (a page too narrow for the margin) gets no line: it names the
 * words at its start. Runs in the preview frame.
 */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  let frame = 0;
  const later = () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; draw(); });
  };

  function draw() {
    for (const doc of document.querySelectorAll('.gm-doc')) drawIn(doc);
  }

  const shown = (el) => el.getClientRects().length > 0
    && (el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true);

  function drawIn(doc) {
    let svg = doc.querySelector(':scope > svg.mk-lines');
    const cells = [...doc.querySelectorAll('.gm-aside-cell[data-mark]')];
    if (!cells.length) {
      svg?.remove();
      return;
    }
    if (!svg) {
      svg = document.createElementNS(NS, 'svg');
      svg.classList.add('mk-lines');
      svg.setAttribute('aria-hidden', 'true');
      doc.append(svg);
    }
    // A slide is scaled to fit: measure on screen, draw in the page's own units.
    const box = doc.getBoundingClientRect();
    const scale = box.width / doc.offsetWidth || 1;
    const at = (x, y) => [(x - box.left) / scale, (y - box.top) / scale];
    svg.setAttribute('width', doc.offsetWidth);
    svg.setAttribute('height', doc.offsetHeight);

    const paths = [];
    // Lines sharing a gap between lines of text run beside each other in it.
    const lanes = new Map();
    for (const cell of cells) {
      const id = cell.dataset.mark;
      const mark = doc.querySelector(`.mk[data-mark="${CSS.escape(id)}"]`);
      if (!mark || !shown(mark) || !shown(cell)) continue;
      const c = cell.getBoundingClientRect();
      const rects = [...mark.getClientRects()];
      // Level with the aside's first line, at its rule.
      const lead = (parseFloat(getComputedStyle(cell).lineHeight) || 18) * scale / 2;
      const ty = c.top + lead;
      const right = Math.max(...rects.map((r) => r.right));
      const left = Math.min(...rects.map((r) => r.left));
      const column = (mark.closest('.gm-speaker') ?? mark.parentElement).getBoundingClientRect();
      // From the end of the mark's last line when the aside is to the right,
      // or the start of its first when the columns are swapped.
      let r, x, edge, tx;
      if (c.left >= right - 1) {
        r = rects.reduce((a, b) => (b.right >= a.right ? b : a));
        [x, edge, tx] = [r.right, Math.max(column.right, r.right), c.left];
      } else if (c.right <= left + 1) {
        r = rects[0];
        [x, edge, tx] = [r.left, Math.min(column.left, r.left), c.right];
      } else {
        continue;
      }
      // Down into the gap under its line of text, along it to the column's
      // edge, and across the margin to the aside: never through the words.
      const block = mark.closest('p, li, h1, h2, h3, h4, h5, h6, td, th') ?? mark.parentElement;
      const height = (parseFloat(getComputedStyle(block).lineHeight) || r.height) * scale;
      const gap = Math.round(r.top + r.height / 2 + height / 2);
      const lane = gap + 2.5 * scale * (lanes.get(gap) ?? 0);
      lanes.set(gap, (lanes.get(gap) ?? 0) + 1);
      const y = mark.matches('.mk-underline, .mk-dotted, .mk-wavy') ? r.bottom - scale : r.top + r.height / 2;
      const [x1, y1] = at(x, y);
      const [xl, yl] = at(edge, lane);
      const [x2, y2] = at(tx, ty);
      const dir = Math.sign(x2 - x1) || 1;
      const turn = Math.min(Math.abs(yl - y1) + 4, Math.abs(xl - x1) / 2) * dir;
      const bend = (x2 - xl) / 2;
      const f = (n) => n.toFixed(1);
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', `M${f(x1)},${f(y1)} C${f(x1 + turn)},${f(y1)} ${f(x1)},${f(yl)} ${f(x1 + turn)},${f(yl)}`
        + ` L${f(xl)},${f(yl)} C${f(xl + bend)},${f(yl)} ${f(x2 - bend)},${f(y2)} ${f(x2)},${f(y2)}`);
      path.dataset.mark = id;
      const ink = getComputedStyle(cell).getPropertyValue('--mk').trim();
      if (ink) path.style.setProperty('--mk', ink);
      if (cell.classList.contains('mk-on')) path.classList.add('mk-on');
      paths.push(path);
    }
    svg.replaceChildren(...paths);
  }

  Preview.register({
    restore() {
      later();
      sizes.disconnect();
      for (const doc of document.querySelectorAll('.gm-doc')) sizes.observe(doc);
    },
  });
  const sizes = new ResizeObserver(later);
  // A step showing, or anything else restyled -- but not this script's own
  // lines, nor what hovering picks out.
  new MutationObserver((records) => {
    if (records.some((r) => !r.target.closest?.('.mk-lines, .mk, .gm-aside-cell[data-mark]'))) later();
  }).observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'hidden'], subtree: true });
  document.addEventListener('transitionend', (e) => { if (!e.target.closest?.('.mk-lines')) later(); });
  // A tab picked shows its asides and marks, and hides another's.
  document.addEventListener('change', (e) => { if (e.target.matches?.('input.tab-pick')) later(); });
  window.addEventListener('preview:drawn', later);
  document.fonts?.ready.then(later);
  // Printing lays the page out again, at the paper's width, before a frame is drawn.
  window.addEventListener('beforeprint', draw);
  window.addEventListener('afterprint', draw);

  const pick = (id, on) => {
    for (const el of document.querySelectorAll(`[data-mark="${CSS.escape(id)}"]`)) el.classList.toggle('mk-on', on);
  };
  for (const [type, on] of [['mouseover', true], ['mouseout', false]]) {
    document.addEventListener(type, (e) => {
      const el = e.target.closest?.('.mk[data-mark], .gm-aside-cell[data-mark]');
      if (!el || el.contains(e.relatedTarget)) return;
      pick(el.dataset.mark, on);
    });
  }
})();
