/**
 * Which slides of a deck don't fit: each is drawn, a slide at a time, in a
 * hidden frame the size of the speaker view's (1280×720), where it shrinks
 * to fit as it would on stage. Hovering Present lists the slides that had
 * to shrink a good deal (below SMALL), and those that don't fit even then;
 * clicking one goes to it. A slide shrunk only a little isn't mentioned.
 *
 * Not every file with a `---` in it is a deck, so nothing is measured, or
 * said, until the file is treated as one: Present is hovered, or pressed.
 * From then on it's measured again as it changes.
 */

import { el, state, RENDER_DELAY } from './state.js';
import { api } from './api.js';
import { baseFor, whenReady } from './render.js';

const SMALL = 0.8;
const ready = whenReady(el.measure);
const decks = new Set();  // paths treated as decks
let timer = 0;
let seq = 0;
let css = '';
let known = new Map();    // a slide's body -> what it came to
let result = null;        // { problems: [{ n, line, zoom, fits }], total } once measured
let progress = null;      // { done, total } while measuring

/** Present hovered or pressed: this file is a deck, so measure it. */
export function treatAsDeck() {
  const path = state.current?.path;
  if (!path || decks.has(path)) return;
  decks.add(path);
  result = null;
  check();
}

/** After a render: measure again, a little after typing stops, if it's a deck. */
export function scheduleFitCheck(isDeck) {
  clearTimeout(timer);
  if (!isDeck || !decks.has(state.current?.path)) {
    seq++;
    result = progress = null;
    draw();
    return;
  }
  timer = setTimeout(check, RENDER_DELAY * 8);
}

async function check() {
  const mine = ++seq;
  const path = state.current?.path;
  if (!path) return;
  let out;
  try {
    out = await api('POST', '/api/slides', { text: el.editor.value, path });
  } catch {
    return;
  }
  await ready;
  if (mine !== seq) return;
  if (out.css !== css) {
    css = out.css;
    known = new Map();
  }
  const problems = [];
  const seen = new Map();
  for (const [i, slide] of out.slides.entries()) {
    let fit = known.get(slide.body);
    if (!fit) {
      // Only a first measurement is shown counting; after an edit, the
      // last result stands until the new one is in.
      if (!result) {
        progress = { done: i, total: out.slides.length };
        draw();
      }
      fit = await measure(slide.body, path);
      if (mine !== seq) return;
    }
    seen.set(slide.body, fit);
    if (fit.zoom < SMALL || !fit.fits) problems.push({ n: i + 1, line: slide.line, ...fit });
  }
  known = seen;
  progress = null;
  result = { problems, total: out.slides.length };
  draw();
}

let ids = 0;
function measure(body, path) {
  const id = ++ids;
  return new Promise((resolve) => {
    const done = (e) => {
      if (e.source !== el.measure.contentWindow || e.data?.type !== 'fit' || e.data.measure !== id) return;
      window.removeEventListener('message', done);
      resolve({ zoom: e.data.zoom, fits: e.data.fits });
    };
    window.addEventListener('message', done);
    el.measure.contentWindow.postMessage({
      type: 'render', css, body, base: baseFor(path), resetScroll: true, deck: true, reveal: Infinity, measure: id,
    }, '*');
  });
}

const percent = (z) => `${Math.round(z * 100)}%`;

/** The list under Present: measuring, all fit, or the slides that don't. */
function draw() {
  const pop = el.fitPop;
  pop.replaceChildren();
  const line = (text, cls) => {
    const p = document.createElement('p');
    p.textContent = text;
    if (cls) p.className = cls;
    pop.append(p);
  };
  if (progress) {
    line(`Measuring slides at 1280×720… ${progress.done} / ${progress.total}`, 'fit-head');
    return;
  }
  if (!result) return;
  const { problems, total } = result;
  if (!problems.length) {
    line(`All ${total} slides fit at 1280×720.`, 'fit-head');
    return;
  }
  line(`At 1280×720, ${problems.length} of ${total} slides ${problems.length === 1 ? 'is' : 'are'} small or too big:`, 'fit-head');
  const list = document.createElement('ul');
  for (const p of problems) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = p.fits ? '' : 'over';
    b.textContent = `Slide ${p.n}, line ${p.line + 1}: ${p.fits ? `shrunk to ${percent(p.zoom)}` : "doesn't fit; it scrolls"}`;
    b.addEventListener('click', () => goTo(p.line));
    const li = document.createElement('li');
    li.append(b);
    list.append(li);
  }
  pop.append(list);
}

/** Puts the cursor at the start of line `n`, near the top of the editor. */
function goTo(n) {
  const lines = el.editor.value.split('\n');
  const offset = lines.slice(0, n).reduce((sum, l) => sum + l.length + 1, 0);
  el.editor.focus();
  el.editor.setSelectionRange(offset, offset);
  const share = n / Math.max(1, lines.length);
  el.editor.scrollTop = Math.max(0, share * el.editor.scrollHeight - el.editor.clientHeight / 4);
  showPop(false);
}

let hideTimer = 0;
function showPop(show) {
  clearTimeout(hideTimer);
  el.fitPop.hidden = !show || (!progress && !result);
}

/** Hovering Present (or the list under it) shows the list, measuring first if need be. */
export function wireFit() {
  const enter = () => {
    treatAsDeck();
    showPop(true);
  };
  const leave = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => showPop(false), 250);
  };
  el.presentWrap.addEventListener('mouseenter', enter);
  el.presentWrap.addEventListener('mouseleave', leave);
  el.presentWrap.addEventListener('focusin', enter);
  el.presentWrap.addEventListener('focusout', leave);
  // Shown as it's measured, while the pointer is still there.
  new MutationObserver(() => {
    if (el.presentWrap.matches(':hover, :focus-within')) showPop(true);
  }).observe(el.fitPop, { childList: true });
}
