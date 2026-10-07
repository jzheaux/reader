/**
 * Presenting: a deck of slides, a step at a time, with a speaker view.
 */

import { el, state, deck, dirty, RENDER_DELAY } from './state.js';
import { api } from './api.js';
import { baseFor } from './render.js';
import { save } from './saving.js';
import { setReading } from './modes.js';
import { toast } from './status.js';
import * as moves from './moves.js';

//
// A file in the format of https://github.com/maaslalani/slides -- slides
// split by a `---` line, `<!-- -->` comments as speaker notes -- can be shown
// one slide at a time, full window. The speaker view is a second window
// (speaker.html) that follows along over a BroadcastChannel and can drive.
//
// A slide shows one step at a time: each block (paragraph, quote, code,
// table, ...) and each list item is a step, in reading order. A slide's
// opening heading is not a step; it shows with the slide. `n` and `p` undo
// each other exactly, a step at a time, crossing slides at either end. `N`
// shows the rest of the slide, or the next one whole; `P` goes back to the
// start of the slide, or to the start of the previous one. See moves.js.

/** Present is offered for a file the server says is a deck when it renders it. */
export function updatePresentable(isDeck = false) {
  el.presentBtn.hidden = !(state.current?.type === 'md' && isDeck);
}

export async function present() {
  if (state.current?.type !== 'md' || deck.open) return;
  if (dirty()) save();
  const line = el.editor.value.slice(0, el.editor.selectionStart).split('\n').length - 1;
  if (!(await loadDeck())) return;
  // Start on the slide being edited, so ⌘⇧. shows the one under the cursor.
  deck.index = Math.max(0, deck.slides.findLastIndex((s) => s.line <= line));
  deck.reveal = 0;
  deck.open = true;
  el.editor.readOnly = true;
  if (document.activeElement === el.editor) el.editor.blur();
  el.deck.hidden = false;
  el.deck.focus();
  announce();
  await showSlide();
}

export async function loadDeck() {
  let out;
  try {
    out = await api('POST', '/api/slides', { text: el.editor.value, path: state.current.path });
  } catch (err) {
    toast(`slides: ${err.message}`, true);
    return false;
  }
  if (!out.slides.length) {
    toast('Nothing to present yet');
    return false;
  }
  deck.slides = out.slides.map((s) => ({ ...s, ...steps(s.body) }));
  deck.css = out.css;
  deck.meta = out.meta || {};
  deck.index = Math.min(deck.index, deck.slides.length - 1);
  deck.reveal = Math.min(deck.reveal, deck.slides[deck.index].steps);
  el.deckBy.textContent = [deck.meta.author, deck.meta.date].filter(Boolean).join(' · ');
  if (deck.open) announce();
  return true;
}

// What counts as a step, among the blocks of a slide.
const LIST = 'ul, ol';
const HEADING = /^H[1-6]$/;

/**
 * Numbers a slide's steps: `data-step="k"` on everything that appears with
 * the k-th press. An aside appears with the last step of the passage it sits
 * beside. Done here, once per deck, so the stage and the speaker view agree.
 */
export function steps(body) {
  const doc = new DOMParser().parseFromString(`<body>${body}</body>`, 'text/html');
  let n = 0;
  let opening = true;
  for (const pair of doc.querySelectorAll('.gm-pair')) {
    const before = n;
    for (const block of pair.querySelector(':scope > .gm-speaker')?.children || []) {
      if (opening && HEADING.test(block.tagName)) { opening = false; continue; }
      opening = false;
      if (block.matches(LIST)) for (const li of block.querySelectorAll('li')) li.dataset.step = ++n;
      else block.dataset.step = ++n;
    }
    if (n === before) continue;
    for (const aside of pair.querySelectorAll(':scope > .gm-asides > *')) aside.dataset.step = n;
  }
  return { body: doc.body.innerHTML, steps: n };
}

/** Puts the current slide on the stage; with `render: false`, only its reveal. */
export async function showSlide({ render = true } = {}) {
  const i = deck.index;
  const slide = deck.slides[i];
  await deck.stageReady;
  if (!deck.open || deck.index !== i) return;
  el.stage.contentWindow.postMessage(render
    ? { type: 'render', css: deck.css, body: slide.body, base: baseFor(state.current.path), resetScroll: true, deck: true, reveal: deck.reveal }
    : { type: 'reveal', reveal: deck.reveal }, '*');
  el.deckCount.textContent = paging(i);
  el.deckNotes.textContent = slide.notes;
  el.deckNotes.hidden = !deck.notes || !slide.notes;
  deck.channel?.postMessage({ type: 'go', index: i, reveal: deck.reveal });
}

/** `paging: Slide %d / %d` from the front matter, as `slides` reads it. */
export function paging(i) {
  const n = deck.slides.length;
  const fmt = deck.meta.paging && deck.meta.paging.includes('%d') ? deck.meta.paging : '%d / %d';
  let k = 0;
  return fmt.replace(/%d/g, () => String(k++ ? n : i + 1));
}

/** Shows slide `i` with `reveal` of its steps; `Infinity` for all of them. */
export function go(i, reveal = 0) {
  if (!deck.open) return;
  const index = Math.min(deck.slides.length - 1, Math.max(0, i));
  const shown = Math.min(deck.slides[index].steps, Math.max(0, reveal));
  if (index === deck.index && shown === deck.reveal) return;
  const render = index !== deck.index;
  deck.index = index;
  deck.reveal = shown;
  showSlide({ render });
}

const move = (to) => {
  const { index, reveal } = to(deck.slides.map((s) => s.steps), deck);
  go(index, reveal);
};

/** n: one more step, or on to the next slide with none of it showing. */
export const next = () => move(moves.next);

/** p: one step fewer, or back to the previous slide with all of it showing. */
export const back = () => move(moves.back);

/** N: the rest of this slide, or the next slide whole. */
export const nextWhole = () => move(moves.nextWhole);

/** P: back to the start of this slide, or to the start of the previous one. */
export const backWhole = () => move(moves.backWhole);

export function closeDeck() {
  if (!deck.open) return;
  deck.open = false;
  el.deck.hidden = true;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  deck.channel?.postMessage({ type: 'end' });
  setReading(state.reading);
}

export function toggleNotes() {
  deck.notes = !deck.notes;
  el.deckNotes.hidden = !deck.notes || !deck.slides[deck.index]?.notes;
  try { localStorage.setItem('reader:notes', deck.notes ? 'shown' : 'hidden'); } catch { /* ignore */ }
}

export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else el.deck.requestFullscreen().catch((err) => toast(err.message, true));
}

export function openSpeaker() {
  const w = window.open('/speaker.html', 'reader-speaker', 'width=960,height=640');
  if (!w) toast('The speaker view was blocked as a popup', true);
}

/** Tell the speaker view everything; it may have just opened. */
export function announce() {
  deck.channel?.postMessage({
    type: 'deck', open: deck.open, css: deck.css, meta: deck.meta, index: deck.index, reveal: deck.reveal,
    slides: deck.slides, base: baseFor(state.current.path), path: state.current.path,
  });
}

export function onSpeakerMessage(e) {
  const m = e.data || {};
  if (m.type === 'hello' && deck.open) announce();
  else if (m.type === 'go') go(m.index, m.reveal);
  else if (m.type === 'key') deckKey(m);
}

/** Keys while presenting. True if the key was the deck's. */
export function deckKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  switch (e.key) {
    case 'n': case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter':
      next(); break;
    case 'p': case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
      back(); break;
    case 'N': nextWhole(); break;
    case 'P': backWhole(); break;
    case 'Home': go(0, 0); break;
    case 'End': go(deck.slides.length - 1, Infinity); break;
    case 'Escape': closeDeck(); break;
    case 't': case 'T': toggleNotes(); break;
    case 'f': case 'F': toggleFullscreen(); break;
    case 's': case 'S': openSpeaker(); break;
    default: return false;
  }
  return true;
}

let deckTimer = 0;
export function scheduleDeckReload() {
  clearTimeout(deckTimer);
  // The stage shows the edited slide, at its new step numbers, right away.
  deckTimer = setTimeout(async () => deck.open && (await loadDeck()) && showSlide(), RENDER_DELAY * 3);
}
