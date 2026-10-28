/**
 * The preview frame: loaded once, sandboxed (an opaque origin), after
 * preview-api.js and the scripts that use it. The parent posts the rendered
 * document in and this swaps it into place, keeping the scroll position; it
 * also steps through a slide, scrolls in step with the editor, shows the image
 * an image link points to, and hands the app's shortcuts back up.
 */
(() => {
  const theme = document.getElementById('theme');
  const base = document.getElementById('base');
  let dim = false;      // steps not yet shown are faint rather than hidden

  function reveal(k, say) {
    hideLater(k);
    // A slide too big even when shrunk scrolls, so what was just revealed
    // is brought into view.
    if (fitted.over) {
      const shown = [...document.querySelectorAll('[data-step]')].filter((n) => Number(n.dataset.step) <= k);
      shown.at(-1)?.scrollIntoView({ block: 'nearest' });
    }
    // The deck says what just showed, in its live region: a new slide its
    // title, a step what's in it, and a slide come to whole both.
    if (say) window.parent.postMessage({ type: 'revealed', ...say, says: saying(say, k) }, '*');
  }

  /** The title, if asked for, then what the steps after `from` showed: `Three. A red square`. */
  function saying({ title, from }, k) {
    const named = title ? Spoken.title(document) : '';
    const shown = from != null ? shownSince(from, k) : '';
    if (!named || !shown) return named || shown;
    return /[.!?:]$/.test(named) ? `${named} ${shown}` : `${named}. ${shown}`;
  }

  // What a step says is read as a screen reader would read it (spoken.js).
  const { spoken, short } = Spoken;

  /** What the steps after `from`, up to the `k`th, showed; or the lines a fence moved its highlight to. */
  function shownSince(from, k) {
    const fresh = (n) => n && Number(n.dataset.step) > from && Number(n.dataset.step) <= k;
    const nodes = [...document.querySelectorAll('[data-step]')]
      .filter((n) => fresh(n) && !fresh(n.parentElement.closest('[data-step]')));
    const moved = (pre) => [...pre.querySelectorAll('.line.hl')].map((line) => spoken(line, k)).join(' ');
    const says = nodes.map((n) => (n.matches('pre[data-focus-steps]') ? moved(n) : spoken(n, k)));
    if (!nodes.length) {
      for (const pre of document.querySelectorAll('pre[data-focus-steps]')) {
        const shows = Number(pre.closest('[data-step]')?.dataset.step);
        if (shows < k && k < shows + Number(pre.dataset.focusSteps)) says.push(moved(pre));
      }
    }
    return short(says.join(' '));
  }

  /** Hides (or dims) the steps after the `k`th, and moves a fence's highlight. */
  function hideLater(k) {
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
      // With its output and callouts' notes, which show from the first step
      // they stand out in.
      const group = pre.closest('.code-group') || pre;
      for (const line of group.querySelectorAll('.line')) {
        line.classList.toggle('hl', (line.dataset.focus || '').split(' ').includes(String(at)));
      }
      for (const shown of group.querySelectorAll('.callout-notes > li[data-focus], pre.output[data-focus]')) {
        const steps = shown.dataset.focus.split(' ').map(Number);
        const later = steps[0] > at;
        shown.classList.toggle('step-hidden', later && !dim);
        shown.classList.toggle('step-dim', later && dim);
        if (shown.matches('li')) shown.classList.toggle('hl', steps.includes(at));
      }
    }
  }

  // A slide is fitted to the window, everything on it together (`zoom`, so
  // a puzzle sized by the window keeps in step with the text): as large as
  // it can be, up to GROW, and no smaller than FLOOR. It's measured with
  // every step shown, so its size doesn't change as they appear. Code still
  // too wide at FLOOR wraps; a slide still too big at FLOOR scrolls. What
  // it came to goes up to the window showing it, with the render's
  // `measure` id if it had one.
  //
  // GROW keeps one short line from filling the screen: twice the size,
  // a statement's heading is a few words to a line, and a short list
  // reads from the back of the room without looking like a poster.
  const FLOOR = 0.6;
  const GROW = 2;
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

  /** The largest zoom from FLOOR to `top` at which the slide fits, or null. */
  function largest(top) {
    zoomTo(top);
    if (fits()) return top;
    zoomTo(FLOOR);
    if (!fits()) return null;
    let lo = FLOOR;
    let hi = top;
    while (hi - lo > 0.01) {
      const mid = (lo + hi) / 2;
      zoomTo(mid);
      if (fits()) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  /** The deck's text size (⌘+ and ⌘−), for the slide's stylesheet. True if it changed. */
  function scaleTo(scale = 1) {
    const root = document.documentElement.style;
    const was = root.getPropertyValue('--reader-text-scale');
    root.setProperty('--reader-text-scale', String(scale));
    return was !== String(scale);
  }

  /**
   * The slide's zoom, or null if it doesn't fit even at FLOOR. How large it
   * grows, or how small it shrinks, is decided at the deck's own text size,
   * 100%; ⌘+ and ⌘− then size that up or down, as far as it still fits. So
   * ⌘− always makes a slide smaller, and ⌘+ makes it bigger if there's room
   * and never smaller.
   */
  function sized() {
    const root = document.documentElement.style;
    const scale = root.getPropertyValue('--reader-text-scale');
    if (!scale || Number(scale) === 1) return largest(GROW);
    root.setProperty('--reader-text-scale', '1');
    const most = largest(GROW);
    root.setProperty('--reader-text-scale', scale);
    return largest(Math.max(most ?? FLOOR, FLOOR));
  }

  function fit(measure) {
    const root = document.documentElement;
    root.classList.remove('fit-wrap', 'fit-over');
    if (!Preview.deck || !document.querySelector('.gm-doc')) {
      zoomTo(1);
      fitted = { zoom: 1, fits: true, wrapped: false, over: false };
      return;
    }
    let zoom = sized();
    const wrapped = zoom == null && [...document.querySelectorAll('.gm-doc pre')].some((pre) => pre.scrollWidth > pre.clientWidth + 1);
    if (wrapped) {
      root.classList.add('fit-wrap');
      zoom = sized();
    }
    const over = zoom == null;
    root.classList.toggle('fit-over', over);
    zoomTo(Math.floor((over ? FLOOR : zoom) * 100) / 100);
    fitted = { zoom: over ? FLOOR : zoom, fits: !over, wrapped, over };
    window.parent.postMessage({ type: 'fit', measure, zoom: fitted.zoom, fits: fitted.fits, wrapped }, '*');
  }

  // Images, fonts and what features draw change a slide's size as they
  // arrive. A measurement waits for them, a little while at most.
  const settled = () => Promise.race([
    Promise.all([
      document.fonts.ready,
      ...Preview.pending(),
      ...[...document.images].filter((img) => !img.complete)
        .map((img) => new Promise((done) => { img.onload = img.onerror = done; })),
    ]),
    new Promise((done) => setTimeout(done, 2000)),
  ]);
  document.addEventListener('load', (e) => { if (Preview.deck && e.target.tagName === 'IMG') fit(); }, true);
  window.addEventListener('preview:drawn', () => { if (Preview.deck) fit(); });
  window.addEventListener('resize', () => fit());

  // Scrolling in step with the editor, by the line of the file each block
  // was drawn from (`data-line`). Whichever side was last touched leads and
  // says which line is at its top; the other follows. Following eases toward
  // where it's sent rather than jumping there, so a scroll that slows to a
  // stop on one side doesn't stutter on the other.
  const EASE = 0.4;
  let marks = null;     // [{ line, top }], rising in both
  let lines = 0;        // how many lines the file has
  let leading = false;  // the reader is scrolling this side
  let goal = 0;
  let at = 0;           // where following has got to, unrounded
  let easing = 0;

  /** Where each marked block is, in document order, the bottom of the page standing for the end of the file. */
  function anchors() {
    if (marks) return marks;
    marks = [{ line: 0, top: 0 }];
    for (const node of document.querySelectorAll('[data-line]')) {
      // Not a tab's pane out of sight, laid under the one showing.
      if (!node.getClientRects().length || node.checkVisibility?.({ visibilityProperty: true }) === false) continue;
      const line = Number(node.dataset.line);
      const top = node.getBoundingClientRect().top + scrollY;
      const last = marks.at(-1);
      if (line > last.line && top >= last.top) marks.push({ line, top });
    }
    const end = document.documentElement.scrollHeight;
    if (lines > marks.at(-1).line && end > marks.at(-1).top) marks.push({ line: lines, top: end });
    return marks;
  }
  new ResizeObserver(() => { marks = null; }).observe(document.body);

  /** `to` for `from`, between the anchors either side of it. */
  function between(from, to, v) {
    const m = anchors();
    let i = 1;
    while (i < m.length - 1 && m[i][from] <= v) i++;
    const a = m[i - 1];
    const b = m[i] ?? a;
    if (b[from] === a[from]) return a[to];
    return a[to] + ((v - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
  }

  function follow(line) {
    leading = false;
    if (Preview.deck) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    goal = Math.max(0, Math.min(max, between('line', 'top', line)));
    if (!easing) {
      at = scrollY;
      easing = requestAnimationFrame(ease);
    }
  }

  function ease() {
    const d = goal - at;
    at = Math.abs(d) < 0.5 ? goal : at + d * EASE;
    window.scrollTo(0, at);
    easing = at === goal ? 0 : requestAnimationFrame(ease);
  }

  function lead() {
    leading = true;
    cancelAnimationFrame(easing);
    easing = 0;
  }
  for (const type of ['wheel', 'pointerdown', 'touchstart', 'keydown']) {
    window.addEventListener(type, lead, { capture: true, passive: true });
  }

  let telling = 0;
  function tell() {
    telling = 0;
    if (leading && !Preview.deck) window.parent.postMessage({ type: 'scrolled', line: between('top', 'line', scrollY) }, '*');
  }
  window.addEventListener('scroll', () => {
    if (leading && !telling) telling = requestAnimationFrame(tell);
  }, { passive: true });

  // Every file a page can point to is served under here, its folder the top
  // of the tree: as `/..` is `/` on disk, a relative link or image with more
  // `..` than there are folders above it stops at the top, and doesn't climb
  // out into the app's own addresses.
  const CONTENT = '/content/';
  const RELATIVE = /^(?![a-z][a-z\d+.-]*:|[/\\#?])/i;

  function withinContent(page) {
    const at = new URL(base.href);
    if (!at.pathname.startsWith(CONTENT)) return;
    // The folder as if it were the top of a site of its own.
    const folder = new URL(at.pathname.slice(CONTENT.length - 1), at.origin);
    for (const [selector, attr] of [['a[href]', 'href'], ['img[src]', 'src']]) {
      for (const node of page.querySelectorAll(selector)) {
        const was = node.getAttribute(attr);
        if (!was || !RELATIVE.test(was)) continue;
        const to = new URL(was, folder);
        node.setAttribute(attr, new URL(CONTENT.slice(0, -1) + to.pathname + to.search + to.hash, at.origin).href);
      }
    }
  }

  // What the keyboard can reach: the control that had it is found again,
  // once a render has replaced it, by its line (its own `data-line`, or that
  // of the nearest element around it with one), its kind, and its place
  // among the controls of that kind on that line. Nothing there means the
  // control is gone, and the keyboard stays on the page.
  const REACHABLE = 'a[href], button, input, select, textarea, [tabindex]';
  const kind = (n) => `${n.tagName} ${n.className}`;
  const lineOf = (n) => n.closest('[data-line]')?.dataset.line ?? null;
  const alike = (line, k) => [...document.body.querySelectorAll(REACHABLE)]
    .filter((n) => lineOf(n) === line && kind(n) === k);
  const controlAt = (n) => (n && n !== document.body && document.body.contains(n)
    ? { line: lineOf(n), kind: kind(n), k: alike(lineOf(n), kind(n)).indexOf(n) } : null);
  function refocus(was) {
    // A feature may have put the keyboard somewhere itself (a field, a puzzle).
    if (!was || was.k < 0 || (document.activeElement && document.activeElement !== document.body)) return;
    alike(was.line, was.kind)[was.k]?.focus({ preventScroll: true });
  }
  // Where the keyboard was as it left the frame: a box ticked passes it
  // through the editor and back (app/editing.js), and the page may be drawn
  // again meanwhile. Only leaving the frame counts: a click on the page's
  // text leaves a control too, and that control isn't to be brought back.
  // Leaving shows as the frame's own blur straight after the control's
  // (document.hasFocus() is still true as the control's comes). Once the
  // keyboard is somewhere in the frame again, the control is forgotten. A
  // click on the page's text puts it there with no focusin, so a click or a
  // key in the frame forgets it too. Not the frame's own focus, though: the
  // app gives that back just before it asks for the control.
  let left = null;
  document.addEventListener('focusout', (e) => {
    if (e.relatedTarget) return;
    const was = { node: e.target, place: controlAt(e.target) };
    const away = () => { left = was; };
    window.addEventListener('blur', away, { once: true });
    setTimeout(() => window.removeEventListener('blur', away));
  });
  const forget = () => { left = null; };
  document.addEventListener('focusin', forget);
  document.addEventListener('pointerdown', forget, true);
  document.addEventListener('keydown', forget, true);
  function giveBack() {
    if (!left) return;
    if (left.node.isConnected) {
      if (document.activeElement === document.body) left.node.focus({ preventScroll: true });
    } else {
      refocus(left.place);
    }
    left = null;
  }

  /** Puts a render in place: the page, its steps, its fit and its scroll. */
  function draw(m) {
    const y = window.scrollY;
    const had = controlAt(document.activeElement);
    if (m.base) base.href = m.base;
    if (theme.textContent !== m.css) theme.textContent = m.css;
    dim = Boolean(m.dim);
    // Whether the page can be worked, settled before the features put back
    // what they kept: a slide can't be (features/blank.js).
    Preview.workable = !m.deck;
    // What features and puzzles were in the middle of carries over.
    Preview.replace(document.body, () => {
      // Put together out of the page first, so no image is asked for
      // before its address is settled.
      const page = document.createElement('template');
      page.innerHTML = m.body;
      withinContent(page.content);
      document.body.replaceChildren(page.content);
      // The document is the page's main part, and its title the page's.
      document.querySelector('.gm-doc')?.setAttribute('role', 'main');
      document.title = m.title || 'Rendered document';
      // Steps to come are hidden before anything measures the page (a
      // puzzle drawing itself, the background's color being read, the
      // fit below): a step first seen showing would fade out, flashing
      // on screen as it went.
      if (m.reveal != null) hideLater(m.reveal);
      Ink.set(m.dark);
    });
    refocus(had);
    hidePeek();
    Preview.deck = Boolean(m.deck);
    document.documentElement.classList.toggle('deck', Preview.deck);
    scaleTo(m.scale);
    fit();
    if (m.measure != null) settled().then(() => fit(m.measure));
    if (m.reveal != null) reveal(m.reveal, m.say);
    marks = null;
    if (m.lines != null) lines = m.lines;
    if (m.resetScroll) {
      cancelAnimationFrame(easing);
      easing = 0;
      window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, y);
      // What's above may have grown or shrunk; put the editor back level.
      tell();
    }
  }

  // One slide giving way to the next: the page as it was and as it is now
  // are drawn over each other while the one is swapped for the other, and
  // the stylesheet moves them by `data-transition`. Where the browser can't,
  // or the reader has asked for less motion, it's a cut. What arrives before
  // the swap happens goes into it (`waiting`): a later render in place of
  // this one, a step onto the slide that's coming and not the one leaving.
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  let waiting = null;
  let moves = 0;

  function show(m) {
    if (waiting) {
      waiting = m;
      return;
    }
    const moved = m.transition && m.transition !== 'none' && document.startViewTransition && !calm.matches;
    if (!moved) return draw(m);
    waiting = m;
    const root = document.documentElement;
    const mine = ++moves;
    root.dataset.transition = m.transition;
    const done = () => { if (mine === moves) delete root.dataset.transition; };
    document.startViewTransition(() => {
      const latest = waiting;
      waiting = null;
      draw(latest);
    }).finished.then(done, done);
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window.parent) return;
    const m = e.data || {};
    if (m.type === 'ping') {
      window.parent.postMessage({ type: 'ready' }, '*');
    } else if (m.type === 'render') {
      show(m);
    } else if (m.type === 'drawn') {
      // What features drew of the last render, once all of it is in place.
      (async () => {
        while (Preview.pending().length) await Promise.all(Preview.pending());
        window.parent.postMessage({ type: 'drawn', drawn: Preview.drawn() }, '*');
      })();
    } else if (m.type === 'reveal') {
      if (waiting) Object.assign(waiting, { reveal: m.reveal }, m.say && { say: m.say }, m.scale && { scale: m.scale });
      else {
        if (scaleTo(m.scale)) fit();
        reveal(m.reveal, m.say);
      }
    } else if (m.type === 'scroll') {
      follow(m.line);
    } else if (m.type === 'refocus') {
      giveBack();
    } else if (m.type === 'tab') {
      tab(m.back, null);
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

  // A link to another markdown file being served opens it in the app, and
  // not as text in a new tab; ⌘ or ⇧ still asks for the tab, and so does a
  // link on stage, where the deck shouldn't give way to another file.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || Preview.deck || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    let url;
    try { url = new URL(a.href); } catch { return; }
    if (url.origin !== new URL(base.href).origin || !/\.(md|markdown)$/i.test(url.pathname)) return;
    e.preventDefault();
    window.parent.postMessage({ type: 'follow', href: url.href }, '*');
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

  // On a slide, a click anywhere but a link, a puzzle, a tab, a card's
  // label, a field, a task's box or choice or a button moves the deck, the left third
  // back and the rest forward.
  document.addEventListener('click', (e) => {
    if (!Preview.deck || (e.target.closest && e.target.closest('a[href], .puzzle, .tab, .qa-toggle, input, label, button, .field'))) return;
    window.parent.postMessage({ type: 'click', left: e.clientX < innerWidth / 3 }, '*');
  });

  // Off a slide, a swipe across the page is passed up: it turns the page of
  // a workbook. Not one that starts on what's dragged or scrolled sideways.
  let touched = null;
  document.addEventListener('touchstart', (e) => {
    const still = e.touches.length === 1 && !e.target.closest?.('.puzzle, pre, table, input, textarea');
    touched = still ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const from = touched;
    touched = null;
    if (!from || Preview.deck) return;
    const dx = e.changedTouches[0].clientX - from.x;
    const dy = e.changedTouches[0].clientY - from.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) window.parent.postMessage({ type: 'swipe', by: dx < 0 ? 1 : -1 }, '*');
  }, { passive: true });

  const DECK_KEYS = new Set([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Backspace']);
  // On a control, the keys that work it are its own, not the deck's: only
  // those, so the rest still move the deck. Anything else Tab reaches by
  // its tabindex, such as a puzzle, says which keys it took (preventDefault).
  const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  const OWN_KEYS = [
    ['input[type=checkbox]', [' ']],
    ['input[type=radio]', [' ', ...ARROWS]],
    ['a[href]', ['Enter']],
    ['button, input[type=button], input[type=submit], input[type=reset]', [' ', 'Enter']],
    ['input, select, textarea', [' ', 'Enter', ...ARROWS]],
  ];
  const owns = (n, key) => Boolean(n.matches && OWN_KEYS.find(([is]) => n.matches(is))?.[1].includes(key));

  /** What Tab reaches on a slide, in order: shown, and one radio button of a group. */
  function reachable() {
    return [...document.body.querySelectorAll(REACHABLE)].filter((n) => {
      if (n.tabIndex < 0 || n.disabled || n.closest('.step-hidden') || n.checkVisibility?.({ visibilityProperty: true }) === false) return false;
      if (n.type !== 'radio' || n.checked) return true;
      const group = [...document.getElementsByName(n.name)];
      return !group.some((r) => r.checked) && group[0] === n;
    });
  }
  /**
   * Tab on a slide goes round what can be reached on it, such as a puzzle
   * or a block's tabs; past the last, or before the first, it gives the
   * keyboard back to the deck.
   */
  function tab(back, from) {
    const all = reachable();
    const at = all.indexOf(from);
    const to = at < 0 ? (back ? all.length - 1 : 0) : at + (back ? -1 : 1);
    if (all[to]) all[to].focus();
    else window.parent.postMessage({ type: 'untab' }, '*');
  }

  // Clicking into the page gives this frame the keyboard, so pass the app's
  // shortcuts (and Esc, which leaves work mode) up to it. On a slide, pass
  // every key: they're all the deck's, but for one a feature has already
  // taken, such as a puzzle's, Tab, and those that work the control that
  // has the keyboard.
  document.addEventListener('keydown', (e) => {
    const meta = e.metaKey || e.ctrlKey;
    if (Preview.deck && !meta && !e.altKey) {
      if (e.defaultPrevented) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        tab(e.shiftKey, e.target);
        return;
      }
      if (owns(e.target, e.key)) return;
      if (DECK_KEYS.has(e.key)) e.preventDefault();
      const { key, code, metaKey, ctrlKey, altKey, shiftKey } = e;
      window.parent.postMessage({ type: 'key', key, code, metaKey, ctrlKey, altKey, shiftKey }, '*');
      return;
    }
    if (!meta && !e.altKey && e.key !== 'Escape') return;
    // ⌥← and ⌥→ turn a workbook's page, but move by a word where there's typing.
    const turning = e.altKey && ['ArrowLeft', 'ArrowRight'].includes(e.key);
    if (turning && e.target.closest?.('input:not([type=checkbox], [type=radio]), textarea, [contenteditable]')) return;
    if (turning) e.preventDefault();
    if ((meta && ['s', 'p', '\\'].includes(e.key.toLowerCase())) || (meta && e.code === 'Period') || (e.ctrlKey && e.key.toLowerCase() === 'g')
      || (meta && e.altKey && ['ArrowUp', 'ArrowDown'].includes(e.key))) e.preventDefault();
    // On a slide, ⌘+, ⌘− and ⌘0 size the slides' text, not the browser's zoom.
    if (Preview.deck && meta && !e.altKey && ['=', '+', '-', '0'].includes(e.key)) e.preventDefault();
    const { key, code, metaKey, ctrlKey, altKey, shiftKey } = e;
    window.parent.postMessage({ type: 'key', key, code, metaKey, ctrlKey, altKey, shiftKey }, '*');
  });

  window.parent.postMessage({ type: 'ready' }, '*');
})();
