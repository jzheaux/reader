import { applyEdits } from './edits.js';

const $ = (id) => document.getElementById(id);
const el = {
  rootName: $('rootName'), crumb: $('crumb'), saveState: $('saveState'),
  sidebarToggle: $('sidebarToggle'), helpToggle: $('helpToggle'), help: $('help'),
  split: $('split'), filter: $('filter'), files: $('files'),
  newBtn: $('newBtn'), newForm: $('newForm'), newName: $('newName'),
  preview: $('preview'), pdfView: $('pdfView'), empty: $('empty'),
  writePane: $('writePane'), editor: $('editor'),
  conflict: $('conflict'), reloadBtn: $('reloadBtn'), overwriteBtn: $('overwriteBtn'),
  dirtyDot: $('dirtyDot'), counts: $('counts'), footPath: $('footPath'), toast: $('toast'),
  readBtn: $('readBtn'), presentBtn: $('presentBtn'),
  deck: $('deck'), stage: $('stage'), deckNotes: $('deckNotes'), deckBy: $('deckBy'), deckCount: $('deckCount'),
};

const RENDER_DELAY = 100;
const AUTOSAVE_DELAY = 1000;

const state = {
  rootName: '',
  files: [],
  current: null,        // { path, type }
  saved: '',            // text as last written to / read from disk
  mtime: null,          // disk mtime that `saved` corresponds to
  conflict: false,
  renderSeq: 0,         // drops out-of-order render responses
  openSeq: 0,           // drops superseded file opens
  saving: Promise.resolve(),
  previewReady: null,
  pendingRender: null,
  reading: false,       // read mode: rendered full width, not editable
};

// The slides being presented, if any. See "presenting" below.
const deck = {
  open: false,
  slides: [],           // [{ body, notes, line }]
  css: '',
  meta: {},
  index: 0,
  reveal: 0,            // how many of this slide's steps are showing
  notes: false,         // the notes strip under the slide
  stageReady: null,
  channel: null,        // talks to the speaker view
};

const dirty = () => state.current?.type === 'md' && el.editor.value !== state.saved;

// ------------------------------------------------------------------ boot ---

// The frame says 'ready' when it loads, but it may have loaded before this
// module ran and that message is gone. So also ask: a 'ping' is answered with
// 'ready' by a frame that's already listening, and lost harmlessly by one
// that isn't (it will announce itself when it loads).
function whenReady(frame) {
  return new Promise((resolve) => {
    window.addEventListener('message', (e) => {
      if (e.source === frame.contentWindow && e.data?.type === 'ready') resolve();
    });
    const ping = () => frame.contentWindow?.postMessage({ type: 'ping' }, '*');
    frame.addEventListener('load', ping);
    ping();
  });
}
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

// ------------------------------------------------------------------- api ---

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `${res.status} ${res.statusText}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const contentUrl = (p) => `/content/${p.split('/').map(encodeURIComponent).join('/')}`;

// ----------------------------------------------------------------- files ---

async function loadTree() {
  const { files } = await api('GET', '/api/tree');
  state.files = files;
  drawTree();
}

function drawTree() {
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

function visiblePaths() {
  return [...el.files.querySelectorAll('.file')].map((b) => b.dataset.path);
}

function step(delta) {
  const paths = visiblePaths();
  if (!paths.length) return;
  const i = paths.indexOf(state.current?.path);
  const next = paths[Math.min(paths.length - 1, Math.max(0, i + delta))];
  if (next && next !== state.current?.path) open(next);
}

async function open(p) {
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

// ------------------------------------------------------------- rendering ---

let renderTimer = 0;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderNow, RENDER_DELAY);
}

async function renderNow({ resetScroll = false } = {}) {
  clearTimeout(renderTimer);
  if (state.current?.type !== 'md') return;
  const seq = ++state.renderSeq;
  const path = state.current.path;
  let out;
  try {
    out = await api('POST', '/api/render', { text: el.editor.value, path });
  } catch (err) {
    return toast(`render: ${err.message}`, true);
  }
  if (seq !== state.renderSeq) return;
  await state.previewReady;
  el.preview.contentWindow.postMessage({
    type: 'render',
    css: out.css,
    body: out.body,
    base: baseFor(path),
    resetScroll,
  }, '*');
}

/** Where a note's relative links and images resolve. */
function baseFor(path) {
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  return new URL(contentUrl(dir), location.href).href;
}

function showPreview() {
  el.preview.hidden = false;
  el.pdfView.hidden = true;
  el.empty.hidden = true;
  el.split.classList.remove('pdf-mode');
}

function showEmpty(msg) {
  el.preview.hidden = true;
  el.pdfView.hidden = true;
  el.empty.hidden = false;
  el.empty.textContent = msg;
  el.editor.disabled = true;
}

// ------------------------------------------------------------------- pdf ---

let pdfjs = null;
let pdfObserver = null;

async function showPdf(p) {
  el.preview.hidden = true;
  el.empty.hidden = true;
  el.pdfView.hidden = false;
  el.split.classList.add('pdf-mode');
  el.editor.disabled = true;
  el.pdfView.replaceChildren();
  el.pdfView.scrollTop = 0;
  pdfObserver?.disconnect();

  try {
    if (!pdfjs) {
      pdfjs = await import('/vendor/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs';
    }
    const doc = await pdfjs.getDocument({ url: contentUrl(p) }).promise;
    if (state.current?.path !== p) return;

    const width = el.pdfView.clientWidth - 32;
    const first = await doc.getPage(1);
    const base = first.getViewport({ scale: 1 });
    const scale = width / base.width;

    // Lay out placeholders for every page at once so the scrollbar is right,
    // then draw each page as it comes into view.
    pdfObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !e.target.dataset.drawn) {
          e.target.dataset.drawn = '1';
          drawPdfPage(doc, Number(e.target.dataset.page), scale, e.target);
        }
      }
    }, { root: el.pdfView, rootMargin: '600px 0px' });

    for (let n = 1; n <= doc.numPages; n++) {
      const sheet = document.createElement('div');
      sheet.className = 'pdf-page';
      sheet.dataset.page = n;
      sheet.style.width = `${Math.floor(base.width * scale)}px`;
      sheet.style.height = `${Math.floor(base.height * scale)}px`;
      el.pdfView.append(sheet);
      pdfObserver.observe(sheet);
    }
  } catch (err) {
    showEmpty(`Couldn't open PDF: ${err.message}`);
  }
}

async function drawPdfPage(doc, n, scale, sheet) {
  const page = await doc.getPage(n);
  const dpr = window.devicePixelRatio || 1;
  const vp = page.getViewport({ scale: scale * dpr });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  sheet.style.height = `${Math.floor(vp.height / dpr)}px`;
  sheet.append(canvas);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
}

// ----------------------------------------------------------------- saving ---

let saveTimer = 0;
function scheduleSave() {
  clearTimeout(saveTimer);
  if (state.conflict) return;
  saveTimer = setTimeout(() => save(), AUTOSAVE_DELAY);
}

/** Saves are queued so two never race each other to disk. */
function save({ explicit = false, force = false } = {}) {
  clearTimeout(saveTimer);
  state.saving = state.saving.then(() => doSave({ explicit, force }));
  return state.saving;
}

async function doSave({ explicit, force }) {
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

function setConflict(on) {
  state.conflict = on;
  el.conflict.hidden = !on;
}

async function reloadFromDisk() {
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
  updatePresentable();
  renderNow();
  if (deck.open) loadDeck().then((ok) => (ok ? showSlide() : closeDeck()));
}

/** When the window regains focus, pick up edits made in another editor. */
async function checkDisk() {
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

// ------------------------------------------------------------ status bits ---

let stateTimer = 0;
function setSaveState(text, cls = '') {
  el.saveState.textContent = text;
  el.saveState.className = `save-state ${cls}`;
  clearTimeout(stateTimer);
  if (cls === 'ok') stateTimer = setTimeout(() => { el.saveState.textContent = ''; }, 1800);
}

function updateDirty() {
  el.dirtyDot.hidden = !dirty();
}

function updateCounts() {
  const text = el.editor.value;
  const words = (text.match(/\S+/g) || []).length;
  const asides = (text.match(/^\s*~(\s|$)/gm) || []).length;
  el.counts.textContent = state.current?.type === 'md'
    ? `${words} word${words === 1 ? '' : 's'}${asides ? ` · ${asides} aside${asides === 1 ? '' : 's'}` : ''}`
    : '';
}

let toastTimer = 0;
function toast(msg, isError = false) {
  el.toast.textContent = msg;
  el.toast.className = `toast${isError ? ' err' : ''}`;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, isError ? 6000 : 2800);
}

// ---------------------------------------------------------------- editing ---

/** Insert via execCommand so the browser's undo stack still works. */
function replaceSelection(text, selectFrom, selectTo) {
  const t = el.editor;
  t.focus();
  const start = t.selectionStart;
  if (!document.execCommand('insertText', false, text)) {
    t.setRangeText(text, t.selectionStart, t.selectionEnd, 'end');
    t.dispatchEvent(new Event('input'));
  }
  if (selectFrom != null) t.setSelectionRange(start + selectFrom, start + selectTo);
}

function wrap(before, after) {
  const t = el.editor;
  const sel = t.value.slice(t.selectionStart, t.selectionEnd);
  replaceSelection(before + sel + after, before.length, before.length + sel.length);
}

function insertLink() {
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
function applyEdit({ edits, undo = false, drawn = false }, { fromStage = false } = {}) {
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

let deckTimer = 0;
function scheduleDeckReload() {
  clearTimeout(deckTimer);
  deckTimer = setTimeout(() => deck.open && loadDeck(), RENDER_DELAY * 3);
}

function onEditorInput() {
  updateDirty();
  updateCounts();
  updatePresentable();
  scheduleRender();
  scheduleSave();
}

// ----------------------------------------------------------------- layout ---

function toggleSidebar(force) {
  const hide = force ?? !el.split.classList.contains('no-sidebar');
  el.split.classList.toggle('no-sidebar', hide);
  try { localStorage.setItem('reader:sidebar', hide ? 'hidden' : 'shown'); } catch { /* ignore */ }
}

function restoreLayout() {
  try {
    if (localStorage.getItem('reader:sidebar') === 'hidden') toggleSidebar(true);
    if (localStorage.getItem('reader:help') === 'shown') el.help.hidden = false;
    if (localStorage.getItem('reader:mode') === 'read') setReading(true);
    deck.notes = localStorage.getItem('reader:notes') === 'shown';
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------- reading ---

/** Read mode: the rendered page full width, the editor out of reach. */
function setReading(on) {
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

// ------------------------------------------------------------- presenting ---
//
// A file in the format of https://github.com/maaslalani/slides -- slides
// split by a `---` line, `<!-- -->` comments as speaker notes -- can be shown
// one slide at a time, full window. The speaker view is a second window
// (speaker.html) that follows along over a BroadcastChannel and can drive.
//
// A slide shows one step at a time: each block (paragraph, quote, code,
// table, ...) and each list item is a step, in reading order. A slide's
// opening heading is not a step; it shows with the slide. `n` and `p` undo
// each other exactly, a step at a time, crossing slides at either end; `N`
// and `P` move a whole slide and arrive with all of it showing.

// Mirrors split() in src/slides.js closely enough to decide whether to offer
// Present: a `---` line after any front matter.
const FRONT_MATTER = /^---[ \t]*\n(?:[ \t]*(?:[\w-]+[ \t]*:.*)?\n)*?---[ \t]*(?:\n|$)/;
const SLIDE_BREAK = /^---[ \t]*$/m;

function updatePresentable() {
  const md = state.current?.type === 'md';
  el.presentBtn.hidden = !(md && SLIDE_BREAK.test(el.editor.value.replace(FRONT_MATTER, '')));
}

async function present() {
  if (state.current?.type !== 'md' || deck.open) return;
  if (dirty()) save();
  const line = el.editor.value.slice(0, el.editor.selectionStart).split('\n').length - 1;
  if (!(await loadDeck())) return;
  // Start on the slide being edited, so ⌘⇧. shows the one under the cursor.
  deck.index = Math.max(0, deck.slides.findLastIndex((s) => s.line <= line));
  deck.reveal = 0;
  deck.open = true;
  el.editor.readOnly = true;
  if (document.activeElement === el.editor) el.editor.blur();
  el.deck.hidden = false;
  el.deck.focus();
  announce();
  await showSlide();
}

async function loadDeck() {
  let out;
  try {
    out = await api('POST', '/api/slides', { text: el.editor.value, path: state.current.path });
  } catch (err) {
    toast(`slides: ${err.message}`, true);
    return false;
  }
  if (!out.slides.length) {
    toast('Nothing to present yet');
    return false;
  }
  deck.slides = out.slides.map((s) => ({ ...s, ...steps(s.body) }));
  deck.css = out.css;
  deck.meta = out.meta || {};
  deck.index = Math.min(deck.index, deck.slides.length - 1);
  deck.reveal = Math.min(deck.reveal, deck.slides[deck.index].steps);
  el.deckBy.textContent = [deck.meta.author, deck.meta.date].filter(Boolean).join(' · ');
  if (deck.open) announce();
  return true;
}

// What counts as a step, among the blocks of a slide.
const LIST = 'ul, ol';
const HEADING = /^H[1-6]$/;

/**
 * Numbers a slide's steps: `data-step="k"` on everything that appears with
 * the k-th press. An aside appears with the last step of the passage it sits
 * beside. Done here, once per deck, so the stage and the speaker view agree.
 */
function steps(body) {
  const doc = new DOMParser().parseFromString(`<body>${body}</body>`, 'text/html');
  let n = 0;
  let opening = true;
  for (const pair of doc.querySelectorAll('.gm-pair')) {
    const before = n;
    for (const block of pair.querySelector(':scope > .gm-speaker')?.children || []) {
      if (opening && HEADING.test(block.tagName)) { opening = false; continue; }
      opening = false;
      if (block.matches(LIST)) for (const li of block.querySelectorAll('li')) li.dataset.step = ++n;
      else block.dataset.step = ++n;
    }
    if (n === before) continue;
    for (const aside of pair.querySelectorAll(':scope > .gm-asides > *')) aside.dataset.step = n;
  }
  return { body: doc.body.innerHTML, steps: n };
}

/** Puts the current slide on the stage; with `render: false`, only its reveal. */
async function showSlide({ render = true } = {}) {
  const i = deck.index;
  const slide = deck.slides[i];
  await deck.stageReady;
  if (!deck.open || deck.index !== i) return;
  el.stage.contentWindow.postMessage(render
    ? { type: 'render', css: deck.css, body: slide.body, base: baseFor(state.current.path), resetScroll: true, deck: true, reveal: deck.reveal }
    : { type: 'reveal', reveal: deck.reveal }, '*');
  el.deckCount.textContent = paging(i);
  el.deckNotes.textContent = slide.notes;
  el.deckNotes.hidden = !deck.notes || !slide.notes;
  deck.channel?.postMessage({ type: 'go', index: i, reveal: deck.reveal });
}

/** `paging: Slide %d / %d` from the front matter, as `slides` reads it. */
function paging(i) {
  const n = deck.slides.length;
  const fmt = deck.meta.paging && deck.meta.paging.includes('%d') ? deck.meta.paging : '%d / %d';
  let k = 0;
  return fmt.replace(/%d/g, () => String(k++ ? n : i + 1));
}

/** Shows slide `i` with `reveal` of its steps; `Infinity` for all of them. */
function go(i, reveal = 0) {
  if (!deck.open) return;
  const index = Math.min(deck.slides.length - 1, Math.max(0, i));
  const shown = Math.min(deck.slides[index].steps, Math.max(0, reveal));
  if (index === deck.index && shown === deck.reveal) return;
  const render = index !== deck.index;
  deck.index = index;
  deck.reveal = shown;
  showSlide({ render });
}

const full = () => deck.reveal >= deck.slides[deck.index].steps;

/** n: one more step, or on to the next slide with none of it showing. */
function next() {
  if (!full()) go(deck.index, deck.reveal + 1);
  else go(deck.index + 1, 0);
}

/** p: one step fewer, or back to the previous slide with all of it showing. */
function back() {
  if (deck.reveal > 0) go(deck.index, deck.reveal - 1);
  else go(deck.index - 1, Infinity);
}

/** N: the rest of this slide, or the next slide whole. */
function nextWhole() {
  if (!full()) go(deck.index, Infinity);
  else go(deck.index + 1, Infinity);
}

/** P: the previous slide whole. */
function backWhole() {
  go(deck.index - 1, Infinity);
}

function closeDeck() {
  if (!deck.open) return;
  deck.open = false;
  el.deck.hidden = true;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  deck.channel?.postMessage({ type: 'end' });
  setReading(state.reading);
}

function toggleNotes() {
  deck.notes = !deck.notes;
  el.deckNotes.hidden = !deck.notes || !deck.slides[deck.index]?.notes;
  try { localStorage.setItem('reader:notes', deck.notes ? 'shown' : 'hidden'); } catch { /* ignore */ }
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else el.deck.requestFullscreen().catch((err) => toast(err.message, true));
}

function openSpeaker() {
  const w = window.open('/speaker.html', 'reader-speaker', 'width=960,height=640');
  if (!w) toast('The speaker view was blocked as a popup', true);
}

/** Tell the speaker view everything; it may have just opened. */
function announce() {
  deck.channel?.postMessage({
    type: 'deck', open: deck.open, css: deck.css, meta: deck.meta, index: deck.index, reveal: deck.reveal,
    slides: deck.slides, base: baseFor(state.current.path), path: state.current.path,
  });
}

function onSpeakerMessage(e) {
  const m = e.data || {};
  if (m.type === 'hello' && deck.open) announce();
  else if (m.type === 'go') go(m.index, m.reveal);
  else if (m.type === 'key') deckKey(m);
}

/** Keys while presenting. True if the key was the deck's. */
function deckKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  switch (e.key) {
    case 'n': case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter':
      next(); break;
    case 'p': case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
      back(); break;
    case 'N': nextWhole(); break;
    case 'P': backWhole(); break;
    case 'Home': go(0, 0); break;
    case 'End': go(deck.slides.length - 1, Infinity); break;
    case 'Escape': closeDeck(); break;
    case 't': case 'T': toggleNotes(); break;
    case 'f': case 'F': toggleFullscreen(); break;
    case 's': case 'S': openSpeaker(); break;
    default: return false;
  }
  return true;
}

function syncScroll() {
  if (state.current?.type !== 'md' || el.preview.hidden) return;
  const t = el.editor;
  const max = t.scrollHeight - t.clientHeight;
  el.preview.contentWindow.postMessage({ type: 'scroll', fraction: max > 0 ? t.scrollTop / max : 0 }, '*');
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.md`;
}

async function createFile(name) {
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

// ------------------------------------------------------------------ wiring ---

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
  el.presentBtn.addEventListener('click', present);
  el.deck.addEventListener('click', (e) => {
    if (e.target.closest('.deck-notes, .deck-foot')) return;
    (e.clientX < window.innerWidth / 3 ? back : next)();
  });
  if ('BroadcastChannel' in window) {
    deck.channel = new BroadcastChannel('reader-deck');
    deck.channel.addEventListener('message', onSpeakerMessage);
  }
  el.editor.addEventListener('scroll', () => requestAnimationFrame(syncScroll), { passive: true });

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
