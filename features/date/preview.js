/**
 * A date (`date:2026-11-10[]`) shows a calendar of its month while it's
 * hovered, the day marked. A click on the date, or Enter, keeps the calendar
 * open, to go from month to month; picking a day writes it into the file in
 * the date's place. While it's kept open the arrow keys move by a day or a
 * week, PageUp and PageDown by a month; Esc, or a click elsewhere, closes
 * it. Not on a slide, where clicks and keys are the deck's. Runs in the
 * preview frame.
 */
(() => {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SCHEME = 'date:';
  const SHOW = 250;   // ms hovered before the calendar shows
  const HIDE = 300;   // ms to get from the date to its calendar

  // Days are plain years, months and days; UTC only to count them by, so
  // the zone this runs in never moves one.
  const utc = ({ year, month, day }) => {
    const d = new Date(0);
    d.setUTCFullYear(year, month - 1, day);
    return d;
  };
  const day = (d) => ({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
  const daysIn = (year, month) => utc({ year, month: month + 1, day: 0 }).getUTCDate();
  const iso = (d) => `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
  const parse = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m && { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  };
  const today = () => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  };
  const inRange = (d) => d.year >= 1 && d.year <= 9999;
  const addDays = (d, n) => day(utc({ ...d, day: d.day + n }));
  const addMonths = (d, n) => {
    const months = d.year * 12 + d.month - 1 + n;
    const year = Math.floor(months / 12);
    const month = months - year * 12 + 1;
    return { year, month, day: Math.min(d.day, daysIn(year, month)) };
  };

  const dateOf = (el) => el.getAttribute('datetime') || '';
  const editable = (t) => (Preview.workable && t.closest && t.closest('.date[data-line]')) || null;
  const dateAt = (line, col) => [...document.querySelectorAll('.date[data-line]')]
    .find((d) => d.dataset.line === String(line) && d.dataset.col === String(col));

  // Outside <body>, which every render replaces.
  const cal = document.createElement('div');
  cal.className = 'date-cal';
  cal.setAttribute('role', 'dialog');
  cal.setAttribute('aria-label', 'Choose a date');
  cal.hidden = true;

  let open = null;      // { el, pinned, at }: the date it's for, and the day the keys are on
  let timer = 0;

  const make = (tag, props, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  };
  const button = (props, text) => make('button', { type: 'button', ...props }, text);

  function draw() {
    const { at, el } = open;
    const chosen = dateOf(el);
    const now = iso(today());
    const grid = make('div', { className: 'date-cal-grid' },
      ...DAYS.map((name) => make('span', { title: name }, name[0])));
    const first = utc({ ...at, day: 1 }).getUTCDay();
    for (let d = 1; d <= daysIn(at.year, at.month); d++) {
      const its = iso({ ...at, day: d });
      const b = button({ tabIndex: d === at.day ? 0 : -1 }, String(d));
      b.dataset.date = its;
      b.setAttribute('aria-label', `${MONTHS[at.month - 1]} ${d}, ${at.year}`);
      if (d === 1) b.style.gridColumnStart = String(first + 1);
      if (its === chosen) {
        b.classList.add('on');
        b.setAttribute('aria-pressed', 'true');
      }
      if (its === now) b.classList.add('today');
      grid.append(b);
    }
    const prev = button({ className: 'date-cal-prev' }, '‹');
    prev.setAttribute('aria-label', 'Previous month');
    const next = button({ className: 'date-cal-next' }, '›');
    next.setAttribute('aria-label', 'Next month');
    cal.replaceChildren(
      make('div', { className: 'date-cal-head' }, prev,
        make('span', { className: 'date-cal-month' }, `${MONTHS[at.month - 1]} ${at.year}`), next),
      grid,
      make('div', { className: 'date-cal-foot' }, button({ className: 'date-cal-today' }, 'Today')),
    );
  }

  // Under the date, or over it when there's no room below; for one that
  // wraps, under the start of its first line.
  function place() {
    const r = open.el.getClientRects()[0] || open.el.getBoundingClientRect();
    const gap = 6;
    const w = cal.offsetWidth;
    const h = cal.offsetHeight;
    const below = r.bottom + 4;
    const top = below + h + gap > innerHeight && r.top - h - 4 >= gap ? r.top - h - 4 : below;
    cal.style.top = `${top}px`;
    cal.style.left = `${Math.max(gap, Math.min(r.left, innerWidth - w - gap))}px`;
  }

  function show(el, { pinned = false, at, focus = false } = {}) {
    clearTimeout(timer);
    open?.el.classList.remove('date-open');
    open = { el, pinned, at: at || parse(dateOf(el)) || today() };
    el.classList.add('date-open');
    el.setAttribute('aria-expanded', 'true');
    if (!cal.isConnected) document.documentElement.append(cal);
    cal.hidden = false;
    draw();
    place();
    if (focus) cal.querySelector('.date-cal-grid [tabindex="0"]')?.focus();
  }

  function close({ refocus = false } = {}) {
    clearTimeout(timer);
    if (!open) return;
    const { el } = open;
    open = null;
    cal.hidden = true;
    el.classList.remove('date-open');
    el.removeAttribute('aria-expanded');
    if (refocus && el.isConnected) el.focus();
  }

  /** Moves the day the keys are on, and the month shown with it. */
  function move(at, { focus = false } = {}) {
    if (!inRange(at)) return;
    open.at = at;
    open.pinned = true;
    draw();
    place();
    if (focus) cal.querySelector('.date-cal-grid [tabindex="0"]')?.focus();
  }

  /** Writes `picked` over the date, on the line it was drawn from. */
  function pick(picked) {
    const { el } = open;
    const was = dateOf(el);
    const line = Number(el.dataset.line);
    const col = Number(el.dataset.col);
    const text = el.dataset.text;
    const from = col + SCHEME.length;
    close();
    if (picked === was || text.slice(col, from) !== SCHEME) return;
    const now = text.slice(0, from) + picked + text.slice(from + was.length);
    // Until the next render, the page is what the file says: this date's
    // line, and where the dates after it on the line have moved to.
    for (const d of document.querySelectorAll(`.date[data-line="${line}"]`)) {
      d.dataset.text = now;
      if (Number(d.dataset.col) > col) d.dataset.col = String(Number(d.dataset.col) + picked.length - was.length);
    }
    el.setAttribute('datetime', picked);
    Preview.edit([{ from: line, to: line + 1, before: [text], after: [now] }], { undo: true });
  }

  // Hovering shows the calendar, after a moment; leaving the date and the
  // calendar both takes it away again, unless it was pinned.
  const later = (fn, ms) => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
  document.addEventListener('mouseover', (e) => {
    if (cal.contains(e.target)) {
      clearTimeout(timer);
      return;
    }
    const el = editable(e.target);
    if (!el) return;
    if (open?.el === el) clearTimeout(timer);
    else if (!open?.pinned) later(() => { if (el.isConnected && Preview.workable) show(el); }, SHOW);
  });
  document.addEventListener('mouseout', (e) => {
    const from = cal.contains(e.target) ? cal : editable(e.target);
    if (!from || from.contains(e.relatedTarget)) return;
    if (!open) clearTimeout(timer);
    else if (!open.pinned) later(close, HIDE);
  });

  document.addEventListener('click', (e) => {
    const el = editable(e.target);
    if (!el) close();
    else if (open?.el === el && open.pinned) close();
    else show(el, { pinned: true, focus: true });
  });

  // A click in the calendar stops here: by the time the page heard of it,
  // the month it was in may have been drawn over.
  cal.addEventListener('click', (e) => {
    e.stopPropagation();
    const b = e.target.closest('button');
    if (!b || !open) return;
    if (b.dataset.date) pick(b.dataset.date);
    else if (b.classList.contains('date-cal-today')) pick(iso(today()));
    else {
      // The arrow is drawn again with the month; the keyboard stays on it.
      const which = b.classList.contains('date-cal-prev') ? 'date-cal-prev' : 'date-cal-next';
      move(addMonths(open.at, which === 'date-cal-prev' ? -1 : 1));
      cal.querySelector(`.${which}`)?.focus();
    }
  });

  const KEYS = {
    ArrowLeft: (at) => addDays(at, -1),
    ArrowRight: (at) => addDays(at, 1),
    ArrowUp: (at) => addDays(at, -7),
    ArrowDown: (at) => addDays(at, 7),
    PageUp: (at) => addMonths(at, -1),
    PageDown: (at) => addMonths(at, 1),
    Home: (at) => ({ ...at, day: 1 }),
    End: (at) => ({ ...at, day: daysIn(at.year, at.month) }),
  };
  // While the calendar is kept open its keys are the calendar's, wherever
  // the click that opened it left the keyboard (on the date, on an arrow
  // since drawn over): caught on the way down, ahead of the page's scrolling
  // and the app's shortcuts.
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing || !Preview.workable) return;
    const inCal = cal.contains(e.target);
    const el = !inCal && e.target.matches?.('.date[data-line]') && e.target;
    const typing = e.target.matches?.('input, textarea, select, [contenteditable]');
    const pick = e.key === 'Enter' || e.key === ' ';
    if (open && !typing && (open.pinned || inCal) && e.key === 'Escape') close({ refocus: true });
    else if (open && !typing && (open.pinned || inCal) && KEYS[e.key]) move(KEYS[e.key](open.at), { focus: true });
    else if (inCal && pick && e.target.closest('button')) e.target.closest('button').click();
    else if (el && pick) show(el, { pinned: true, focus: true });
    else if (el && e.key === 'Escape' && open) close();
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  window.addEventListener('scroll', () => { if (open) place(); }, { passive: true });
  window.addEventListener('resize', () => { if (open) place(); });

  // A calendar kept open stays open through a re-render, on the month it
  // had got to; one only hovered goes.
  Preview.register({
    keep: () => {
      if (!open) return null;
      const { el, pinned, at } = open;
      const kept = pinned && { line: el.dataset.line, col: el.dataset.col, at, focus: cal.contains(document.activeElement) };
      close();
      return kept;
    },
    restore: (root, kept) => {
      const el = kept && dateAt(kept.line, kept.col);
      if (el && Preview.workable) show(el, { pinned: true, at: kept.at, focus: kept.focus });
    },
  });
})();
