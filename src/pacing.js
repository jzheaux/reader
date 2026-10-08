/**
 * A deck's pacing plan, from its notes and front matter, for the speaker
 * view to hold the clock against:
 *
 *   ---
 *   time: 50m                   the talk's length
 *   ---
 *
 *   <!--
 *   ACT 2. Clock should read about 0:12.     a checkpoint: this slide
 *   at: 0:12                                 starts 12 minutes in (h:mm)
 *   time: 1.5m                               this slide's own budget
 *   -->
 *
 * A checkpoint is read from an `at:` line, or from "Clock: 0:00" or "Clock
 * should read about 0:12" written anywhere in a note. Durations are `90s`,
 * `1.5m`, `1.5 min`, `1h`, or a bare number of minutes. Other durations in
 * the prose ("1.5 min.", "60 minutes: aim for 48-50") aren't read: they're
 * as often a section's or the whole talk's as the slide's.
 *
 * `at:` and `time:` lines are for reader, so they come out of the notes
 * shown; a clock line is the speaker's own, and stays.
 */

const UNITS = { h: 3600, m: 60, s: 1 };
const DURATION = /^(\d+(?:\.\d+)?)\s*(h|hours?|m|mins?|minutes?|s|secs?|seconds?)?$/i;
const CLOCK_TIME = /^(\d+):([0-5]\d)$/;
const DIRECTIVE = /^[ \t]*(at|time)[ \t]*:[ \t]*(.+?)[ \t]*$/i;
const CLOCK = /\bclock(?:\s+should\s+read)?(?:\s+about)?\s*:?\s*(\d+:[0-5]\d)\b/i;

/** `1.5m`, `90s`, `1h`, `50` (minutes) -> seconds, or null. */
export function duration(text) {
  const m = DURATION.exec(String(text ?? '').trim());
  if (!m) return null;
  return Math.round(Number(m[1]) * UNITS[(m[2] || 'm')[0].toLowerCase()]);
}

/** `0:12` (h:mm), or a duration -> seconds from the start, or null. */
export function clockTime(text) {
  const m = CLOCK_TIME.exec(String(text ?? '').trim());
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : duration(text);
}

/**
 * Reads a slide's notes: `{ notes, at, budget }`, the notes without their
 * `at:` and `time:` lines, and what those (or a clock line) said, in
 * seconds. A line that only looks like one -- `time: be quick` -- stays.
 */
export function readNotes(notes) {
  let at = null;
  let budget = null;
  const kept = [];
  for (const line of notes.split('\n')) {
    const m = DIRECTIVE.exec(line);
    const value = m && (m[1].toLowerCase() === 'at' ? clockTime(m[2]) : duration(m[2]));
    if (value == null) {
      kept.push(line);
      continue;
    }
    if (m[1].toLowerCase() === 'at') at = value;
    else budget = value;
  }
  if (at == null) {
    const clock = CLOCK.exec(notes);
    if (clock) at = clockTime(clock[1]);
  }
  return { notes: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), at, budget };
}

/**
 * When each slide should start, in seconds, given each one's checkpoint
 * (`at`) and budget, and the talk's length (`total`), or null where the
 * plan doesn't say. The first slide starts at 0 unless it says otherwise;
 * between two checkpoints (the end of the talk being the last), the time
 * the budgets don't account for is shared evenly among the slides without
 * one. Past the last checkpoint with no length given, only budgets count,
 * and a slide without one leaves the rest unknown.
 */
export function plan(slides, total = null) {
  const n = slides.length;
  const start = new Array(n).fill(null);
  const anchors = [];
  slides.forEach((s, i) => {
    if (s.at != null) anchors.push({ i, t: s.at });
  });
  if (n && slides[0].at == null) anchors.unshift({ i: 0, t: 0 });
  if (total != null) anchors.push({ i: n, t: total });

  for (let k = 0; k < anchors.length; k++) {
    const from = anchors[k];
    const to = anchors[k + 1];
    if (from.i >= n) break;
    const end = to ? to.i : n;
    const span = slides.slice(from.i, end);
    const unknown = span.filter((s) => s.budget == null).length;
    const known = span.reduce((sum, s) => sum + (s.budget ?? 0), 0);
    const share = to && unknown ? Math.max(0, (to.t - from.t - known) / unknown) : null;
    let t = from.t;
    for (let i = from.i; i < end; i++) {
      start[i] = t;
      const spent = slides[i].budget ?? share;
      // Without a budget or an end to share, the rest is unknown.
      if (spent == null) break;
      t += spent;
    }
  }
  // A checkpoint is where its slide starts, even if the slides before it
  // ran over or under.
  for (const a of anchors) if (a.i < n) start[a.i] = a.t;
  return start;
}

/** When the last slide should end: the talk's length, or its start and budget. */
export function planEnd(slides, starts, total = null) {
  if (total != null) return total;
  const last = slides.length - 1;
  return last >= 0 && starts[last] != null && slides[last].budget != null ? starts[last] + slides[last].budget : null;
}
