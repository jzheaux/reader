/**
 * Editing: the editor's shortcuts, and edits the rendered page asks for.
 */

import { applyEdits } from '../edits.js';
import { el, state, deck } from './state.js';
import { renderNow, scheduleRender } from './render.js';
import { scheduleSave } from './saving.js';
import { loadDeck, showSlide, scheduleDeckReload } from './deck.js';
import { updateDirty, updateCounts } from './status.js';

/** Insert via execCommand so the browser's undo stack still works. */
export function replaceSelection(text, selectFrom, selectTo) {
  const t = el.editor;
  t.focus();
  const start = t.selectionStart;
  if (!document.execCommand('insertText', false, text)) {
    t.setRangeText(text, t.selectionStart, t.selectionEnd, 'end');
    t.dispatchEvent(new Event('input'));
  }
  if (selectFrom != null) t.setSelectionRange(start + selectFrom, start + selectTo);
}

export function wrap(before, after) {
  const t = el.editor;
  const sel = t.value.slice(t.selectionStart, t.selectionEnd);
  replaceSelection(before + sel + after, before.length, before.length + sel.length);
}

export function insertLink() {
  const t = el.editor;
  const sel = t.value.slice(t.selectionStart, t.selectionEnd) || 'text';
  const text = `[${sel}](https://)`;
  replaceSelection(text, sel.length + 3, text.length - 1);
}

/**
 * The rendered page (or a slide) asked for an edit: a checkbox ticked, a
 * field filled in, a puzzle played. It names the lines it was drawn from and
 * what they said (see edits.js); if they've changed since, the page was
 * behind, so it's drawn again instead. It works in read mode too: ticking a
 * box or filling in a form isn't editing the file.
 *
 * `undo` puts the edit on the editor's undo stack, which means passing it
 * through the editor's focus; not in read mode or while presenting, though,
 * and not for a field or puzzle, which would lose the keyboard. `drawn` says the page shows the
 * edit already and needn't be rendered again for it.
 */
export function applyEdit({ edits, undo = false, drawn = false }, { fromStage = false } = {}) {
  if (state.current?.type !== 'md') return;
  const t = el.editor;
  const change = applyEdits(t.value, edits);
  if (!change || (change.start === change.end && !change.text)) {
    renderNow();
    if (deck.open) loadDeck().then((ok) => ok && showSlide());
    return;
  }
  const lines = t.value.split('\n').length;
  const { selectionStart, selectionEnd, scrollTop } = t;
  if (undo && !state.reading && !deck.open) {
    t.focus({ preventScroll: true });
    t.setSelectionRange(change.start, change.end);
    if (!document.execCommand('insertText', false, change.text)) {
      t.setRangeText(change.text, change.start, change.end);
      t.dispatchEvent(new Event('input'));
    }
    t.setSelectionRange(selectionStart, selectionEnd);
  } else {
    t.setRangeText(change.text, change.start, change.end);
    if (drawn) {
      updateDirty();
      updateCounts();
      scheduleSave();
      // Lines below moved, so what the page knows of them is out of date.
      if (t.value.split('\n').length !== lines) scheduleRender();
    } else {
      onEditorInput();
    }
  }
  t.scrollTop = scrollTop;
  if (fromStage) {
    // The slide shows the edit already; bring the deck and the (hidden)
    // preview up to date for when they're next drawn.
    scheduleRender();
    scheduleDeckReload();
  }
}

export function onEditorInput() {
  updateDirty();
  updateCounts();
  scheduleRender();
  scheduleSave();
}
