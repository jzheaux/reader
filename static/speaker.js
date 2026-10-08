/**
 * The speaker view: a window of its own (speaker.html) that follows the deck
 * being presented over a BroadcastChannel, and can drive it. It shows the
 * current slide (steps to come drawn faintly), the next slide, the notes, a
 * timer and the time.
 */
const $ = (id) => document.getElementById(id);
const channel = new BroadcastChannel('reader-deck');
const deck = { slides: [], css: '', meta: {}, index: 0, reveal: 0, base: '', end: null, open: false };
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
  $('notes').innerHTML = deck.slides[i]?.notesHtml || '';
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

const pad = (x) => String(x).padStart(2, '0');
function clock(seconds) {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

function tick() {
  const elapsed = Math.floor((Date.now() - started) / 1000);
  $('timer').textContent = clock(elapsed);
  $('time').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  pace(elapsed);
}

// Within this much of the plan is on it.
const GRACE = 30;

/**
 * Where the plan (from the notes' checkpoints and budgets; see
 * src/pacing.js) says to be on this slide, against the timer: ahead of its
 * start, between its start and the next slide's, or past that.
 */
function pace(elapsed) {
  const el = $('pace');
  const slide = deck.slides[deck.index];
  const from = slide?.plan;
  if (from == null) {
    el.hidden = true;
    return;
  }
  const to = deck.index + 1 < deck.slides.length ? deck.slides[deck.index + 1].plan : deck.end;
  const span = to != null && to > from ? `${clock(from)}–${clock(to)}` : clock(from);
  let state = 'on';
  let say = 'on plan';
  if (elapsed < from - GRACE) {
    state = 'ahead';
    say = `${clock(from - elapsed)} ahead`;
  } else if (to != null && elapsed > to + GRACE) {
    state = elapsed - to > 120 ? 'late' : 'behind';
    say = `${clock(elapsed - to)} behind`;
  }
  el.hidden = false;
  el.className = `pace ${state}`;
  el.replaceChildren();
  const b = document.createElement('b');
  b.textContent = say;
  el.append(b, ` · ${slide.at != null ? 'checkpoint' : 'plan'} ${span}`);
}

channel.addEventListener('message', (e) => {
  const m = e.data || {};
  if (m.type === 'deck') {
    // A deck opened on its first slide is the talk starting: so is the timer.
    if (m.open && !deck.open && m.index === 0) started = Date.now();
    Object.assign(deck, { slides: m.slides, css: m.css, meta: m.meta, index: m.index, reveal: m.reveal, base: m.base, end: m.end, open: Boolean(m.open) });
    $('waiting').hidden = Boolean(m.open);
    draw({ fresh: true });
  } else if (m.type === 'go') {
    deck.index = m.index;
    deck.reveal = m.reveal;
    draw();
    tick();
  } else if (m.type === 'end') {
    deck.open = false;
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
