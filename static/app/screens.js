/**
 * Two screens: the slides full screen on the projector, the speaker view on
 * the laptop. With the Window Management API (Chromium), reader asks which
 * screens there are -- the browser asks the user's leave, once -- and
 * takes the one reader is on as the laptop, and another (an external one,
 * if it can tell) as the room's. Without it, or without leave, or with one
 * screen, presenting stays in this window, and the speaker view is dragged
 * where it goes.
 */

let known = null;         // { laptop, room } once found

/**
 * The laptop's screen and the room's, or null. Asks only when there's more
 * than one screen to ask about.
 */
export async function findScreens() {
  if (!window.screen.isExtended || !('getScreenDetails' in window)) return (known = null);
  try {
    const details = await window.getScreenDetails();
    const laptop = details.currentScreen;
    const others = details.screens.filter((s) => s !== laptop);
    const room = others.find((s) => !s.isInternal) || others[0];
    known = room ? { laptop, room } : null;
  } catch {
    known = null;
  }
  return known;
}

/** The room's screen, if two have been found. */
export const roomScreen = () => known?.room ?? null;

/** Where the speaker view goes: all of the laptop's screen, if known. */
export function speakerFeatures() {
  const s = known?.laptop;
  return s
    ? `left=${s.availLeft},top=${s.availTop},width=${s.availWidth},height=${s.availHeight}`
    : 'width=960,height=640';
}

/** Moves an already open speaker view onto the laptop's screen. */
export function placeSpeaker(w) {
  const s = known?.laptop;
  if (!s || !w) return;
  try {
    w.moveTo(s.availLeft, s.availTop);
    w.resizeTo(s.availWidth, s.availHeight);
  } catch { /* a window that won't move stays where it is */ }
}
