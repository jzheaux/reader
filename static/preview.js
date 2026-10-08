/**
 * The preview frame: loaded once, sandboxed (an opaque origin), after
 * preview-api.js and the scripts that use it. The parent posts the rendered
 * document in and this swaps it into place, keeping the scroll position; it
 * also steps through a slide, scrolls along with the editor, shows the image
 * an image link points to, and hands the app's shortcuts back up.
 */
(() => {
  const theme = document.getElementById('theme');
  const base = document.getElementById('base');
  let dim = false;      // steps not yet shown are faint rather than hidden

  function reveal(k) {
    for (const node of document.querySelectorAll('[data-step]')) {
      const later = Number(node.dataset.step) > k;
      node.classList.toggle('step-hidden', later && !dim);
      node.classList.toggle('step-dim', later && dim);
    }
    // A fence written `{1-3|5}` moves its highlight a range at a time, from
    // the step it shows with.
    for (const pre of document.querySelectorAll('pre[data-focus-steps]')) {
      const shows = pre.closest('[data-step]');
      if (!shows) continue;
      const at = Math.min(Number(pre.dataset.focusSteps), Math.max(1, k - Number(shows.dataset.step) + 1));
      for (const line of pre.querySelectorAll('.line')) {
        line.classList.toggle('hl', (line.dataset.focus || '').split(' ').includes(String(at)));
      }
    }
    // A slide too big even when shrunk scrolls, so what was just revealed
    // is brought into view.
    if (fitted.over) {
      const shown = [...document.querySelectorAll('[data-step]')].filter((n) => Number(n.dataset.step) <= k);
      shown.at(-1)?.scrollIntoView({ block: 'nearest' });
    }
  }

  // A slide is shrunk to fit the window, everything on it together (`zoom`,
  // so a puzzle sized by the window shrinks with the text), as large as it
  // can be and no smaller than FLOOR. It's measured with every step shown,
  // so its size doesn't change as they appear. Code still too wide at FLOOR
  // wraps; a slide still too big at FLOOR scrolls. What it came to goes up
  // to the window showing it, with the render's `measure` id if it had one.
  const FLOOR = 0.6;
  let fitted = { zoom: 1, fits: true, wrapped: false, over: false };

  function zoomTo(z) {
    document.documentElement.style.setProperty('--fit', String(z));
  }

  function fits() {
    const doc = document.querySelector('.gm-doc');
    if (doc.offsetHeight > innerHeight + 1) return false;
    // Inside the slide's margins: a column grows as wide as code that won't
    // wrap, past them.
    const right = doc.getBoundingClientRect().right - parseFloat(getComputedStyle(doc).paddingRight);
    if ([...doc.querySelectorAll('.gm-pair > *')].some((c) => c.getBoundingClientRect().right > right + 1)) return false;
    return [...doc.querySelectorAll('pre')].every((pre) => pre.scrollWidth <= pre.clientWidth + 1);
  }

  /** The largest zoom from FLOOR to 1 at which the slide fits, or null. */
  function largest() {
    zoomTo(1);
    if (fits()) return 1;
    zoomTo(FLOOR);
    if (!fits()) return null;
    let lo = FLOOR;
    let hi = 1;
    while (hi - lo > 0.01) {
      const mid = (lo + hi) / 2;
      zoomTo(mid);
      if (fits()) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  function fit(measure) {
    const root = document.documentElement;
    root.classList.remove('fit-wrap', 'fit-over');
    if (!Preview.deck || !document.querySelector('.gm-doc')) {
      zoomTo(1);
      fitted = { zoom: 1, fits: true, wrapped: false, over: false };
      return;
    }
    let zoom = largest();
    const wrapped = zoom == null && [...document.querySelectorAll('.gm-doc pre')].some((pre) => pre.scrollWidth > pre.clientWidth + 1);
    if (wrapped) {
      root.classList.add('fit-wrap');
      zoom = largest();
    }
    const over = zoom == null;
    root.classList.toggle('fit-over', over);
    zoomTo(Math.floor((over ? FLOOR : zoom) * 100) / 100);
    fitted = { zoom: over ? FLOOR : zoom, fits: !over, wrapped, over };
    window.parent.postMessage({ type: 'fit', measure, zoom: fitted.zoom, fits: fitted.fits, wrapped }, '*');
  }

  // Images and fonts change a slide's size as they arrive. A measurement
  // waits for them, a little while at most.
  const settled = () => Promise.race([
    Promise.all([
      document.fonts.ready,
      ...[...document.images].filter((img) => !img.complete)
        .map((img) => new Promise((done) => { img.onload = img.onerror = done; })),
    ]),
    new Promise((done) => setTimeout(done, 2000)),
  ]);
  document.addEventListener('load', (e) => { if (Preview.deck && e.target.tagName === 'IMG') fit(); }, true);
  window.addEventListener('resize', () => fit());

  window.addEventListener('message', (e) => {
    if (e.source !== window.parent) return;
    const m = e.data || {};
    if (m.type === 'ping') {
      window.parent.postMessage({ type: 'ready' }, '*');
    } else if (m.type === 'render') {
      const y = window.scrollY;
      if (m.base) base.href = m.base;
      if (theme.textContent !== m.css) theme.textContent = m.css;
      // What features and puzzles were in the middle of carries over.
      Preview.replace(document.body, () => {
        document.body.innerHTML = m.body;
      });
      hidePeek();
      Preview.deck = Boolean(m.deck);
      document.documentElement.classList.toggle('deck', Preview.deck);
      dim = Boolean(m.dim);
      fit();
      if (m.measure != null) settled().then(() => fit(m.measure));
      if (m.reveal != null) reveal(m.reveal);
      if (m.resetScroll) window.scrollTo(0, 0);
      else window.scrollTo(0, y);
    } else if (m.type === 'reveal') {
      reveal(m.reveal);
    } else if (m.type === 'scroll') {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.max(0, m.fraction * max));
    }
  });

  // In-page anchors scroll here rather than opening a new tab.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    const t = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (t) t.scrollIntoView({ behavior: 'smooth' });
  });

  // A link to an image shows the image while it's hovered.
  const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;
  const peek = document.createElement('img');
  peek.className = 'peek';
  peek.alt = '';
  let peeking = null;

  function showPeek(a) {
    peeking = a;
    // Outside <body>, which every render replaces.
    if (!peek.isConnected) document.documentElement.append(peek);
    peek.hidden = true;
    peek.onload = () => { if (peeking === a) place(a); };
    peek.src = a.href;
    if (peek.complete && peek.naturalWidth) place(a);
  }

  // Above and to the right of the link, so the link stays readable. For a
  // link that wraps, that's off the end of its first line.
  function place(a) {
    peek.hidden = false;
    const r = a.getClientRects()[0] || a.getBoundingClientRect();
    const w = peek.offsetWidth;
    const h = peek.offsetHeight;
    const gap = 8;
    const top = Math.max(gap, r.top - h - 2);
    const left = Math.max(gap, Math.min(r.right + 4, innerWidth - w - gap));
    peek.style.top = `${top}px`;
    peek.style.left = `${left}px`;
  }

  function hidePeek() {
    peeking = null;
    peek.hidden = true;
  }

  const imageLink = (t) => {
    const a = t.closest && t.closest('a[href]');
    if (!a) return null;
    try { return IMAGE.test(new URL(a.href).pathname) ? a : null; } catch { return null; }
  };
  document.addEventListener('mouseover', (e) => {
    const a = imageLink(e.target);
    if (a && a !== peeking) showPeek(a);
  });
  document.addEventListener('mouseout', (e) => {
    const a = imageLink(e.target);
    if (a && a === peeking && !a.contains(e.relatedTarget)) hidePeek();
  });
  window.addEventListener('scroll', hidePeek, { passive: true });

  // On a slide, a click anywhere but a link or a puzzle moves the deck, the
  // left third back and the rest forward.
  document.addEventListener('click', (e) => {
    if (!Preview.deck || (e.target.closest && e.target.closest('a[href], .puzzle'))) return;
    window.parent.postMessage({ type: 'click', left: e.clientX < innerWidth / 3 }, '*');
  });

  const DECK_KEYS = new Set([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Backspace']);

  // Clicking into the page gives this frame the keyboard, so pass the app's
  // shortcuts (and Esc, which leaves read mode) up to it. On a slide, pass
  // every key: they're all the deck's.
  document.addEventListener('keydown', (e) => {
    const meta = e.metaKey || e.ctrlKey;
    if (Preview.deck && !meta && !e.altKey) {
      if (DECK_KEYS.has(e.key)) e.preventDefault();
      const { key, code, metaKey, ctrlKey, altKey, shiftKey } = e;
      window.parent.postMessage({ type: 'key', key, code, metaKey, ctrlKey, altKey, shiftKey }, '*');
      return;
    }
    if (!meta && !e.altKey && e.key !== 'Escape') return;
    if ((meta && ['s', '\\'].includes(e.key.toLowerCase())) || (meta && e.code === 'Period')
      || (e.altKey && ['ArrowUp', 'ArrowDown'].includes(e.key))) e.preventDefault();
    const { key, code, metaKey, ctrlKey, altKey, shiftKey } = e;
    window.parent.postMessage({ type: 'key', key, code, metaKey, ctrlKey, altKey, shiftKey }, '*');
  });

  window.parent.postMessage({ type: 'ready' }, '*');
})();
