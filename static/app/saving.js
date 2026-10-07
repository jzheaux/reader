/**
 * Saving: autosave, explicit saves, conflicts with edits made elsewhere.
 */

import { el, state, deck, dirty, AUTOSAVE_DELAY } from './state.js';
import { api } from './api.js';
import { renderNow } from './render.js';
import { loadDeck, showSlide, closeDeck } from './deck.js';
import { loadTree } from './files.js';
import { setSaveState, updateDirty, updateCounts, toast } from './status.js';

let saveTimer = 0;
export function scheduleSave() {
  clearTimeout(saveTimer);
  if (state.conflict) return;
  saveTimer = setTimeout(() => save(), AUTOSAVE_DELAY);
}

/** Saves are queued so two never race each other to disk. */
export function save({ explicit = false, force = false } = {}) {
  clearTimeout(saveTimer);
  state.saving = state.saving.then(() => doSave({ explicit, force }));
  return state.saving;
}

export async function doSave({ explicit, force }) {
  const cur = state.current;
  if (cur?.type !== 'md') return;
  if (state.conflict && !force) return;
  const text = el.editor.value;
  if (text === state.saved && !explicit) return;

  setSaveState('saving…');
  try {
    const out = await api('PUT', '/api/file', {
      path: cur.path, text, baseMtime: state.mtime, explicit, force,
    });
    if (state.current?.path !== cur.path) return;
    state.saved = text;
    state.mtime = out.mtime;
    setConflict(false);
    setSaveState('saved', 'ok');
    const f = state.files.find((x) => x.path === cur.path);
    if (f) f.mtime = out.mtime;
  } catch (err) {
    if (err.status === 409) {
      setConflict(true);
      setSaveState('not saved', 'err');
    } else {
      setSaveState('not saved', 'err');
      toast(`save failed: ${err.message}`, true);
    }
  }
  updateDirty();
}

export function setConflict(on) {
  state.conflict = on;
  el.conflict.hidden = !on;
}

export async function reloadFromDisk() {
  if (state.current?.type !== 'md') return;
  const file = await api('GET', `/api/file?path=${encodeURIComponent(state.current.path)}`);
  const { selectionStart, selectionEnd, scrollTop } = el.editor;
  state.saved = file.text;
  state.mtime = file.mtime;
  el.editor.value = file.text;
  el.editor.setSelectionRange(selectionStart, selectionEnd);
  el.editor.scrollTop = scrollTop;
  setConflict(false);
  updateDirty();
  updateCounts();
  renderNow();
  if (deck.open) loadDeck().then((ok) => (ok ? showSlide() : closeDeck()));
}

/** When the window regains focus, pick up edits made in another editor. */
export async function checkDisk() {
  loadTree().catch(() => {});
  if (state.current?.type !== 'md' || state.conflict) return;
  let file;
  try {
    file = await api('GET', `/api/file?path=${encodeURIComponent(state.current.path)}`);
  } catch {
    return;
  }
  if (file.mtime === state.mtime) return;
  if (dirty()) setConflict(true);
  else reloadFromDisk();
}
