import { test } from 'node:test';
import assert from 'node:assert/strict';
import { file, run } from './dom.js';

/**
 * The speaker view, loaded as speaker.html loads it, on a clock that reads
 * `now.seconds`: `say` sends it a message from the deck, as the
 * BroadcastChannel would.
 */
function speaker() {
  const now = { seconds: 0 };
  let heard = null;
  const window = file('static/speaker.html');
  Object.assign(window, {
    BroadcastChannel: class {
      addEventListener(type, fn) { heard = fn; }
      postMessage() {}
    },
    Date: class {
      static now() { return now.seconds * 1000; }
      toLocaleTimeString() { return '9:00'; }
    },
    setInterval() {},
  });
  run(window, 'static/theme.js', 'static/speaker.js');
  const $ = (id) => window.document.getElementById(id);
  return { now, $, clock: window.clock, say: (data) => heard({ data }) };
}

test('the waiting message makes the speaker sections inert until a deck opens', () => {
  const { $, say } = speaker();
  const timerIsInert = () => $('timer').closest('[inert]') !== null;

  assert.equal(timerIsInert(), true);
  say({ type: 'deck', open: true, index: 0, reveal: 0, slides: [{}], meta: {} });
  assert.equal(timerIsInert(), false);
  say({ type: 'end' });
  assert.equal(timerIsInert(), true);
});

test('the timer reads minutes and seconds, and hours once there are some', () => {
  const { clock } = speaker();
  assert.equal(clock(0), '0:00');
  assert.equal(clock(5), '0:05');
  assert.equal(clock(59.6), '1:00');
  assert.equal(clock(754), '12:34');
  assert.equal(clock(3600), '1:00:00');
  assert.equal(clock(3725), '1:02:05');
  assert.equal(clock(36000 + 59), '10:00:59');
});

test('the timer starts when the deck opens on its first slide, and counts from there', () => {
  const { now, $, say } = speaker();
  now.seconds = 1000;
  say({ type: 'deck', open: true, index: 0, reveal: 0, slides: [{}, {}], meta: {} });
  now.seconds = 1075;
  say({ type: 'go', index: 1, reveal: 0 });
  assert.equal($('timer').textContent, '1:15');
  // Picked up on a later slide, it's the same talk.
  say({ type: 'deck', open: false, index: 1, reveal: 0, slides: [{}, {}], meta: {} });
  say({ type: 'deck', open: true, index: 1, reveal: 0, slides: [{}, {}], meta: {} });
  now.seconds = 1080;
  say({ type: 'go', index: 1, reveal: 0 });
  assert.equal($('timer').textContent, '1:20');
});

// Three slides planned to start at 0:00 (a checkpoint), 2:00 and 5:00,
// the talk to end at 6:00.
const PLANNED = [{ plan: 0, at: 0 }, { plan: 120 }, { plan: 300 }];

/** What the pace says on slide `index` at `seconds` into the talk. */
function paced(slides, index, seconds, end = null) {
  const { now, $, say } = speaker();
  say({ type: 'deck', open: true, index: 0, reveal: 0, slides, meta: {}, end });
  now.seconds = seconds;
  say({ type: 'go', index, reveal: 0 });
  const pace = $('pace');
  return pace.hidden ? null : { state: pace.className, says: pace.textContent };
}

test('on a slide between its start and the next one\'s, give or take half a minute, the talk is on plan', () => {
  assert.deepEqual(paced(PLANNED, 0, 10, 360), { state: 'pace on', says: 'on plan · checkpoint 0:00–2:00' });
  assert.deepEqual(paced(PLANNED, 1, 90, 360), { state: 'pace on', says: 'on plan · plan 2:00–5:00' });
  assert.deepEqual(paced(PLANNED, 1, 330, 360), { state: 'pace on', says: 'on plan · plan 2:00–5:00' });
});

test('before a slide\'s start it\'s ahead, and after the next one\'s behind, then late two minutes on', () => {
  assert.deepEqual(paced(PLANNED, 1, 89, 360), { state: 'pace ahead', says: '0:31 ahead · plan 2:00–5:00' });
  assert.deepEqual(paced(PLANNED, 1, 331, 360), { state: 'pace behind', says: '0:31 behind · plan 2:00–5:00' });
  assert.deepEqual(paced(PLANNED, 1, 420, 360), { state: 'pace behind', says: '2:00 behind · plan 2:00–5:00' });
  assert.deepEqual(paced(PLANNED, 1, 421, 360), { state: 'pace late', says: '2:01 behind · plan 2:00–5:00' });
});

test('the last slide runs to the talk\'s end, or, with none, is never behind', () => {
  assert.deepEqual(paced(PLANNED, 2, 400, 360), { state: 'pace behind', says: '0:40 behind · plan 5:00–6:00' });
  assert.deepEqual(paced(PLANNED, 2, 4000), { state: 'pace on', says: 'on plan · plan 5:00' });
});

test('a slide with no plan has no pace, and one planned no later than the next shows only its start', () => {
  assert.equal(paced([{}, {}], 0, 10), null);
  assert.equal(paced([{ plan: 0 }, {}], 1, 10), null);
  assert.deepEqual(paced([{ plan: 60, at: 60 }, { plan: 60 }], 0, 70), { state: 'pace on', says: 'on plan · checkpoint 1:00' });
});

test('the timer restarts from the keyboard: R anywhere, or Enter on the timer itself', () => {
  const { now, $, say } = speaker();
  const window = $('timer').ownerDocument.defaultView;
  say({ type: 'deck', open: true, index: 0, reveal: 0, slides: [{}, {}], meta: {} });
  now.seconds = 75;
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'r' }));
  now.seconds = 80;
  say({ type: 'go', index: 1, reveal: 0 });
  assert.equal($('timer').textContent, '0:05');
  assert.equal($('timer').tagName, 'BUTTON');
  // Enter on it is its own, and doesn't move the deck too.
  const enter = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  $('timer').dispatchEvent(enter);
  assert.equal(enter.defaultPrevented, false);
});

test('the pace is said aloud when it changes, not as it counts', () => {
  const { now, $, say } = speaker();
  const heard = () => $('pace-heard').textContent;
  say({ type: 'deck', open: true, index: 0, reveal: 0, slides: PLANNED, meta: {}, end: 360 });
  now.seconds = 10;
  say({ type: 'go', index: 1, reveal: 0 });
  assert.equal(heard(), '1:50 ahead of plan');
  now.seconds = 20;
  say({ type: 'go', index: 1, reveal: 0 });
  assert.equal(heard(), '1:50 ahead of plan');
  now.seconds = 200;
  say({ type: 'go', index: 1, reveal: 0 });
  assert.equal(heard(), 'On plan');
  now.seconds = 400;
  say({ type: 'go', index: 1, reveal: 0 });
  assert.equal(heard(), '1:40 behind plan');
  now.seconds = 500;
  say({ type: 'go', index: 1, reveal: 0 });
  assert.equal(heard(), '3:20 behind plan');
  assert.equal($('pace-heard').getAttribute('role'), 'status');
});
