/**
 * The speaker view: a window of its own (speaker.html) that follows the deck
 * being presented over a BroadcastChannel, and can drive it. It shows the
 * current slide (steps to come drawn faintly), the next slide, the notes, a
 * timer and the time.
 */
const $ = (id) => document.getElementById(id);
const channel = new BroadcastChannel('reader-deck');
const deck = { slides: [], css: '', meta: {}, index: 0, reveal: 0, base: '' };
let started = Date.now();

function whenReady(frame) {
  return new Promise((resolve) => {
    window.addEventListener('message', (e) => {
      if (e.source === frame.contentWindow && e.data?.type === 'ready') resolve();
    });
    const ping = () => frame.contentWindow?.postMessage({ type: 'ping' }, '*');
    frame.addEventListener('load', ping);
    ping();
  });
}
const ready = { now: whenReady($('now')), next: whenReady($('next')) };

const shown = { now: -1, next: -1 };

// "Now" is what the room sees, with the steps still to come drawn faintly.
// "Next" is the next slide, whole.
async function show(name, i, reveal) {
  await ready[name];
  const slide = deck.slides[i];
  const frame = $(name).contentWindow;
  if (shown[name] === i && slide) return frame.postMessage({ type: 'reveal', reveal }, '*');
  shown[name] = i;
  frame.postMessage({
    type: 'render', css: deck.css, body: slide ? slide.body : '', base: deck.base, resetScroll: true,
    reveal, dim: name === 'now',
  }, '*');
}

function draw({ fresh = false } = {}) {
  const i = deck.index;
  const n = deck.slides.length;
  if (fresh) shown.now = shown.next = -1;
  show('now', i, deck.reveal);
  show('next', i + 1, Infinity);
  $('end').hidden = i + 1 < n;
  $('notes').textContent = deck.slides[i]?.notes || '';
  const steps = deck.slides[i]?.steps || 0;
  $('count').textContent = `${i + 1} / ${n}`;
  $('steps').textContent = steps ? '●'.repeat(deck.reveal) + '○'.repeat(steps - deck.reveal) : '';
  document.title = `${i + 1} / ${n} · speaker view`;
}

function fit() {
  for (const f of document.querySelectorAll('.screen iframe')) {
    f.style.transform = `scale(${f.parentElement.clientWidth / 1280})`;
  }
}

function tick() {
  const s = Math.floor((Date.now() - started) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (x) => String(x).padStart(2, '0');
  $('timer').textContent = h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
  $('time').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

channel.addEventListener('message', (e) => {
  const m = e.data || {};
  if (m.type === 'deck') {
    Object.assign(deck, { slides: m.slides, css: m.css, meta: m.meta, index: m.index, reveal: m.reveal, base: m.base });
    $('waiting').hidden = Boolean(m.open);
    draw({ fresh: true });
  } else if (m.type === 'go') {
    deck.index = m.index;
    deck.reveal = m.reveal;
    draw();
  } else if (m.type === 'end') {
    $('waiting').hidden = false;
    $('waiting').textContent = 'The deck was closed. Press Present in reader to pick it up again.';
  }
});

// How the slide on stage was fitted, as the room sees it at this size.
window.addEventListener('message', (e) => {
  if (e.source !== $('now').contentWindow || e.data?.type !== 'fit') return;
  const { zoom, fits } = e.data;
  $('fit').hidden = fits && zoom >= 1;
  $('fit').classList.toggle('over', !fits);
  $('fit').textContent = fits ? `shrunk to ${Math.round(zoom * 100)}%` : "doesn't fit; scrolls";
});

// The keys that move through the deck work here too; the deck does the moving.
const MOVES = new Set(['n', 'N', 'p', 'P', 'ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter',
  'ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'Home', 'End']);
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || !MOVES.has(e.key)) return;
  e.preventDefault();
  channel.postMessage({ type: 'key', key: e.key });
});

$('timer').addEventListener('click', () => { started = Date.now(); tick(); });
window.addEventListener('resize', fit);
fit();
tick();
setInterval(tick, 1000);
channel.postMessage({ type: 'hello' });
