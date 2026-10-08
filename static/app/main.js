/**
 * The app: a sidebar of files, the editor, the rendered page beside it, and
 * read mode and presenting. Each part is a module here; this one starts it
 * and connects the page's events and keys to them.
 */

import { el, state, deck, dirty } from './state.js';
import { api } from './api.js';
import { loadTree, drawTree, visiblePaths, step, open, today, createFile } from './files.js';
import { whenReady, showEmpty } from './render.js';
import { save, reloadFromDisk, checkDisk } from './saving.js';
import { toast } from './status.js';
import { replaceSelection, wrap, insertLink, applyEdit, onEditorInput } from './editing.js';
import { toggleSidebar, restoreLayout, setReading } from './modes.js';
import { present, back, next, deckKey, onSpeakerMessage } from './deck.js';
import { wireFit } from './fit.js';
import { wireSync } from './sync.js';

state.previewReady = whenReady(el.preview);
deck.stageReady = whenReady(el.stage);

init().catch((err) => toast(`startup: ${err.message}`, true));

async function init() {
  wire();
  restoreLayout();
  const info = await api('GET', '/api/info');
  state.rootName = info.name;
  el.rootName.textContent = info.name;
  el.rootName.title = info.root;
  await loadTree();

  const wanted = decodeURIComponent(location.hash.slice(1));
  const first = state.files.find((f) => f.path === wanted) || state.files.find((f) => f.type === 'md') || state.files[0];
  if (first) await open(first.path);
  else showEmpty('No markdown files here yet. Press New to start one.');
}

function wire() {
  el.editor.addEventListener('input', onEditorInput);
  window.addEventListener('message', (e) => {
    // The stage takes the mouse, for image previews, so it hands back the
    // keys and clicks that drive the deck.
    if (deck.open && e.source === el.stage.contentWindow) {
      if (e.data?.type === 'key') deckKey(e.data);
      else if (e.data?.type === 'click') (e.data.left ? back : next)();
      else if (e.data?.type === 'edit') applyEdit(e.data, { fromStage: true });
      return;
    }
    if (e.source !== el.preview.contentWindow) return;
    if (e.data?.type === 'edit') applyEdit(e.data);
    else if (e.data?.type === 'key') onKey({ ...e.data, preventDefault() {} });
  });

  el.readBtn.addEventListener('click', () => setReading(!state.reading));
  wireFit();
  el.presentBtn.addEventListener('click', present);
  el.deck.addEventListener('click', (e) => {
    if (e.target.closest('.deck-notes, .deck-foot')) return;
    (e.clientX < window.innerWidth / 3 ? back : next)();
  });
  if ('BroadcastChannel' in window) {
    deck.channel = new BroadcastChannel('reader-deck');
    deck.channel.addEventListener('message', onSpeakerMessage);
  }
  wireSync();

  el.filter.addEventListener('input', drawTree);
  el.filter.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = visiblePaths()[0];
      if (first) open(first);
    } else if (e.key === 'Escape') {
      el.filter.value = '';
      drawTree();
    }
  });

  el.newBtn.addEventListener('click', () => {
    el.newForm.hidden = !el.newForm.hidden;
    if (!el.newForm.hidden) {
      el.newName.value = today();
      el.newName.focus();
      el.newName.setSelectionRange(0, el.newName.value.length - 3);
    }
  });
  el.newForm.addEventListener('submit', (e) => {
    e.preventDefault();
    createFile(el.newName.value.trim());
  });
  el.newName.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') el.newForm.hidden = true;
  });

  el.sidebarToggle.addEventListener('click', () => toggleSidebar());
  el.helpToggle.addEventListener('click', () => {
    el.help.hidden = !el.help.hidden;
    try { localStorage.setItem('reader:help', el.help.hidden ? 'hidden' : 'shown'); } catch { /* ignore */ }
  });

  el.reloadBtn.addEventListener('click', () => reloadFromDisk().catch((e) => toast(e.message, true)));
  el.overwriteBtn.addEventListener('click', () => save({ explicit: true, force: true }));

  window.addEventListener('focus', checkDisk);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty()) save();
    else if (document.visibilityState === 'visible') checkDisk();
  });
  window.addEventListener('beforeunload', (e) => {
    if (!dirty() || state.conflict) return;
    // Best effort: a keepalive request outlives the page.
    fetch('/api/file', {
      method: 'PUT',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: state.current.path, text: el.editor.value, baseMtime: state.mtime }),
    });
    e.preventDefault();
  });

  window.addEventListener('keydown', onKey);
}

function onKey(e) {
  const meta = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  if (deck.open) {
    if (deckKey(e)) e.preventDefault();
    return;
  }
  if (meta && !e.altKey && e.code === 'Period') {
    e.preventDefault();
    if (e.shiftKey) present();
    else setReading(!state.reading);
    return;
  }
  if (state.reading && e.key === 'Escape') { setReading(false); return; }
  if (meta && !e.altKey && key === 's') { e.preventDefault(); save({ explicit: true }); return; }
  if (meta && e.key === '\\') { e.preventDefault(); toggleSidebar(); return; }
  if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); step(-1); return; }
  if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); step(1); return; }

  if (document.activeElement !== el.editor) return;
  if (meta && !e.shiftKey && key === 'b') { e.preventDefault(); wrap('**', '**'); return; }
  if (meta && !e.shiftKey && key === 'i') { e.preventDefault(); wrap('*', '*'); return; }
  if (meta && !e.shiftKey && key === 'k') { e.preventDefault(); insertLink(); return; }
  if (e.key === 'Tab' && !meta && !e.altKey && el.editor.selectionStart === el.editor.selectionEnd && !e.shiftKey) {
    e.preventDefault();
    replaceSelection('  ');
  }
}
