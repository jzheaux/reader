/**
 * The layout: the file list shown or hidden, and read mode.
 */

import { el, state, deck, dirty } from './state.js';
import { save } from './saving.js';

export function toggleSidebar(force) {
  const hide = force ?? !el.split.classList.contains('no-sidebar');
  el.split.classList.toggle('no-sidebar', hide);
  try { localStorage.setItem('reader:sidebar', hide ? 'hidden' : 'shown'); } catch { /* ignore */ }
}

export function restoreLayout() {
  try {
    if (localStorage.getItem('reader:sidebar') === 'hidden') toggleSidebar(true);
    if (localStorage.getItem('reader:help') === 'shown') el.help.hidden = false;
    if (localStorage.getItem('reader:mode') === 'read') setReading(true);
    deck.notes = localStorage.getItem('reader:notes') === 'shown';
  } catch { /* ignore */ }
}

/** Read mode: the rendered page full width, the editor out of reach. */
export function setReading(on) {
  state.reading = on;
  el.split.classList.toggle('read-mode', on);
  el.editor.readOnly = on || deck.open;
  el.readBtn.textContent = on ? 'Edit' : 'Read';
  el.readBtn.title = on ? 'Back to editing (⌘. or Esc)' : 'Read without editing (⌘.)';
  if (on) {
    if (document.activeElement === el.editor) el.editor.blur();
    if (dirty()) save();
  } else if (state.current?.type === 'md' && !deck.open) {
    el.editor.focus({ preventScroll: true });
  }
  try { localStorage.setItem('reader:mode', on ? 'read' : 'edit'); } catch { /* ignore */ }
}
