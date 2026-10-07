/**
 * The file list, and opening and creating files.
 */

import { el, state, dirty } from './state.js';
import { api } from './api.js';
import { save, setConflict } from './saving.js';
import { showPdf } from './pdf.js';
import { renderNow, showPreview } from './render.js';
import { setSaveState, updateCounts, toast } from './status.js';
import { updatePresentable } from './deck.js';

export async function loadTree() {
  const { files } = await api('GET', '/api/tree');
  state.files = files;
  drawTree();
}

export function drawTree() {
  const q = el.filter.value.trim().toLowerCase();
  el.files.replaceChildren();
  for (const f of state.files) {
    if (q && !f.path.toLowerCase().includes(q)) continue;
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'file' + (state.current?.path === f.path ? ' now' : '');
    b.dataset.path = f.path;
    b.title = f.path;

    const slash = f.path.lastIndexOf('/');
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = f.path.slice(slash + 1).replace(/\.(md|markdown)$/i, '');
    b.append(name);
    if (slash > 0 || f.type === 'pdf') {
      const sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = [slash > 0 ? f.path.slice(0, slash) : '', f.type === 'pdf' ? 'pdf' : ''].filter(Boolean).join(' · ');
      b.append(sub);
    }
    b.addEventListener('click', () => open(f.path));
    li.append(b);
    el.files.append(li);
  }
}

export function visiblePaths() {
  return [...el.files.querySelectorAll('.file')].map((b) => b.dataset.path);
}

export function step(delta) {
  const paths = visiblePaths();
  if (!paths.length) return;
  const i = paths.indexOf(state.current?.path);
  const next = paths[Math.min(paths.length - 1, Math.max(0, i + delta))];
  if (next && next !== state.current?.path) open(next);
}

export async function open(p) {
  const seq = ++state.openSeq;
  if (dirty()) await save();
  if (seq !== state.openSeq) return;

  const entry = state.files.find((f) => f.path === p);
  const type = entry?.type || (/\.pdf$/i.test(p) ? 'pdf' : 'md');
  setConflict(false);

  if (type === 'pdf') {
    state.current = { path: p, type };
    state.saved = '';
    el.editor.value = '';
    showPdf(p);
  } else {
    let file;
    try {
      file = await api('GET', `/api/file?path=${encodeURIComponent(p)}`);
    } catch (err) {
      return toast(err.message, true);
    }
    if (seq !== state.openSeq) return;
    state.current = { path: p, type };
    state.saved = file.text;
    state.mtime = file.mtime;
    el.editor.value = file.text;
    el.editor.disabled = false;
    el.editor.scrollTop = 0;
    el.editor.setSelectionRange(0, 0);
    showPreview();
    renderNow({ resetScroll: true });
  }

  history.replaceState(null, '', `#${encodeURIComponent(p)}`);
  document.title = `${p} — ${state.rootName}`;
  el.crumb.textContent = p;
  el.footPath.textContent = p;
  setSaveState('');
  updateCounts();
  updatePresentable();
  drawTree();
  el.files.querySelector('.file.now')?.scrollIntoView({ block: 'nearest' });
}

export function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.md`;
}

export async function createFile(name) {
  try {
    const out = await api('POST', '/api/new', { name });
    el.newForm.hidden = true;
    await loadTree();
    await open(out.path);
    if (!out.created) toast(`${out.path} already exists — opened it`);
    el.editor.focus();
  } catch (err) {
    toast(err.message, true);
  }
}
