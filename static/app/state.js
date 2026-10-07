/**
 * What every part of the app shares: the page's elements, the open file and
 * what's known of it on disk, and the deck being presented.
 */



const $ = (id) => document.getElementById(id);
export const el = {
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

export const RENDER_DELAY = 100;
export const AUTOSAVE_DELAY = 1000;

export const state = {
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
export const deck = {
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

export const dirty = () => state.current?.type === 'md' && el.editor.value !== state.saved;
