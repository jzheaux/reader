/**
 * Scrolling the editor and the rendered page together, either way round.
 *
 * Each is placed by the line of the file at its top: the page's blocks carry
 * the line they were drawn from (see preview.js), and here a hidden copy of
 * the editor's text, wrapped the same way, gives each line's top. Whichever
 * side was last touched leads and the other follows, easing toward where it's
 * sent so that a scroll slowing to a stop doesn't stutter. The follower's own
 * scrolling isn't sent back.
 */

import { el, state, deck } from './state.js';

const EASE = 0.4;
let leader = 'editor';
let tops = null;      // each line's top in the editor, and the bottom of the last
let measured = null;  // the text they were measured for
let mirror = null;
let mirrored = [];    // the lines the mirror holds
let sending = 0;
let goal = 0;
let at = 0;           // where following has got to, unrounded
let easing = 0;
let waiting = null;   // a line from the page, for when the editor is back in view

const synced = () => state.current?.type === 'md' && !el.preview.hidden && !deck.open;
const shown = () => !state.reading && el.editor.clientWidth > 0;

const COPIED = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'tabSize',
  'whiteSpace', 'overflowWrap', 'wordBreak', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'];

/** Each line's top in the editor, measured from the mirror, which only redraws the lines that changed. */
function measure() {
  const t = el.editor;
  if (tops && measured === t.value) return tops;
  measured = t.value;
  if (!mirror) {
    mirror = document.createElement('div');
    mirror.className = 'editor-mirror';
    mirror.setAttribute('aria-hidden', 'true');
    document.body.append(mirror);
  }
  const style = getComputedStyle(t);
  for (const p of COPIED) mirror.style[p] = style[p];
  mirror.style.width = `${t.clientWidth}px`;

  const lines = t.value.split('\n');
  let head = 0;
  while (head < lines.length && head < mirrored.length && lines[head] === mirrored[head]) head++;
  let tail = 0;
  while (tail < lines.length - head && tail < mirrored.length - head
    && lines[lines.length - 1 - tail] === mirrored[mirrored.length - 1 - tail]) tail++;
  const stale = [...mirror.children].slice(head, mirrored.length - tail);
  const fresh = lines.slice(head, lines.length - tail).map((line) => {
    const d = document.createElement('div');
    d.textContent = line || ' ';
    return d;
  });
  if (stale.length) stale[0].replaceWith(...fresh);
  else mirror.insertBefore(fragment(fresh), mirror.children[head] ?? null);
  for (const d of stale.slice(1)) d.remove();
  mirrored = lines;

  tops = [...mirror.children].map((d) => d.offsetTop);
  const last = mirror.lastElementChild;
  tops.push(last.offsetTop + last.offsetHeight);
  return tops;
}

function fragment(nodes) {
  const f = document.createDocumentFragment();
  f.append(...nodes);
  return f;
}

/** The line (with how far into it) at `y` in the editor. */
function lineAt(y) {
  const m = measure();
  let lo = 0;
  let hi = m.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (m[mid] <= y) lo = mid;
    else hi = mid;
  }
  const h = m[lo + 1] - m[lo];
  return lo + (h > 0 ? Math.max(0, Math.min(1, (y - m[lo]) / h)) : 0);
}

/** Where line `n` (with a fraction) is in the editor. */
function topOf(n) {
  const m = measure();
  const i = Math.max(0, Math.min(m.length - 2, Math.floor(n)));
  return m[i] + (n - i) * (m[i + 1] - m[i]);
}

/** Tells the page where the editor is, if the editor is leading. */
export function sendScroll() {
  sending = 0;
  if (leader !== 'editor' || !synced() || !shown()) return;
  el.preview.contentWindow.postMessage({ type: 'scroll', line: lineAt(el.editor.scrollTop) }, '*');
}

/** The page was scrolled to `line`: the editor follows. */
function follow(line, { now = false } = {}) {
  leader = 'preview';
  if (!synced()) return;
  if (!shown()) {
    waiting = line;
    return;
  }
  waiting = null;
  const t = el.editor;
  goal = Math.max(0, Math.min(t.scrollHeight - t.clientHeight, topOf(line)));
  if (now) {
    stopEasing();
    t.scrollTop = goal;
  } else if (!easing) {
    at = t.scrollTop;
    easing = requestAnimationFrame(ease);
  }
}

function ease() {
  const d = goal - at;
  at = Math.abs(d) < 0.5 ? goal : at + d * EASE;
  el.editor.scrollTop = at;
  easing = at === goal ? 0 : requestAnimationFrame(ease);
}

function stopEasing() {
  cancelAnimationFrame(easing);
  easing = 0;
}

export function wireSync() {
  const lead = () => {
    leader = 'editor';
    waiting = null;
    stopEasing();
  };
  for (const type of ['wheel', 'pointerdown', 'touchstart', 'keydown']) {
    el.editor.addEventListener(type, lead, { passive: true });
  }
  el.editor.addEventListener('scroll', () => {
    if (leader === 'editor' && !sending) sending = requestAnimationFrame(sendScroll);
  }, { passive: true });
  // Its width changes how lines wrap; coming back from read mode, it catches
  // up with where the page was read to.
  new ResizeObserver(() => {
    tops = null;
    if (waiting != null && shown()) follow(waiting, { now: true });
  }).observe(el.editor);
  document.fonts?.ready.then(() => { tops = null; });

  window.addEventListener('message', (e) => {
    if (e.source === el.preview.contentWindow && e.data?.type === 'scrolled') follow(e.data.line);
  });
}
