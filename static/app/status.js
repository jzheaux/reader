/**
 * The bits of status around the editor: saved or not, word count, toasts.
 */

import { el, state, dirty } from './state.js';

let stateTimer = 0;
export function setSaveState(text, cls = '') {
  el.saveState.textContent = text;
  el.saveState.className = `save-state ${cls}`;
  clearTimeout(stateTimer);
  if (cls === 'ok') stateTimer = setTimeout(() => { el.saveState.textContent = ''; }, 1800);
}

export function updateDirty() {
  el.dirtyDot.hidden = !dirty();
}

export function updateCounts() {
  const text = el.editor.value;
  const words = (text.match(/\S+/g) || []).length;
  const asides = (text.match(/^\s*~(\s|$)/gm) || []).length;
  el.counts.textContent = state.current?.type === 'md'
    ? `${words} word${words === 1 ? '' : 's'}${asides ? ` · ${asides} aside${asides === 1 ? '' : 's'}` : ''}`
    : '';
}

let toastTimer = 0;
export function toast(msg, isError = false) {
  el.toast.textContent = msg;
  el.toast.className = `toast${isError ? ' err' : ''}`;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, isError ? 6000 : 2800);
}
