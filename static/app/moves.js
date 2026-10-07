/**
 * Where each key moves the deck: from a slide and how many of its steps are
 * showing, to another. Only numbers in and out, so it's tested without a page.
 *
 * `steps` is each slide's step count; `at` is `{ index, reveal }`. A move
 * off either end of the deck stays where it is.
 */

const clamp = (steps, index, reveal) => ({ index, reveal: Math.min(steps[index], Math.max(0, reveal)) });

// To slide `index`, if there is one: else nowhere, rather than (say) the last
// slide with none of it showing.
const to = (steps, at, index, reveal) =>
  index < 0 || index >= steps.length ? { ...at } : clamp(steps, index, reveal);

const full = (steps, { index, reveal }) => reveal >= steps[index];

/** n: one more step, or on to the next slide with none of it showing. */
export function next(steps, at) {
  return full(steps, at) ? to(steps, at, at.index + 1, 0) : clamp(steps, at.index, at.reveal + 1);
}

/** p: one step fewer, or back to the previous slide with all of it showing. */
export function back(steps, at) {
  return at.reveal > 0 ? clamp(steps, at.index, at.reveal - 1) : to(steps, at, at.index - 1, Infinity);
}

/** N: the rest of this slide, or the next slide whole. */
export function nextWhole(steps, at) {
  return full(steps, at) ? to(steps, at, at.index + 1, Infinity) : clamp(steps, at.index, Infinity);
}

/** P: back to the start of this slide, or to the start of the previous one. */
export function backWhole(steps, at) {
  return at.reveal > 0 ? clamp(steps, at.index, 0) : to(steps, at, at.index - 1, 0);
}
