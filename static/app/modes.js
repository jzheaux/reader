/**
 * The layout: the file list shown or hidden, and work mode.
 */

import { el, state, deck, dirty, remembered, remember } from './state.js';
import { save } from './saving.js';
import { renderNow } from './render.js';
import { openAt } from './pages.js';
import { frontMatter, typeOf } from '../markdown.js';

// At this width and under the list doesn't fit beside the panes, so ☰ and
// ⌘\ open it over them instead; picking a file, Esc or a click elsewhere
// closes it again.
const NARROW = matchMedia('(max-width: 900px)');

export function toggleSidebar(force) {
  const drawer = NARROW.matches || el.split.classList.contains('list-open') || el.split.classList.contains('work-mode');
  if (drawer && force === undefined) return toggleDrawer();
  const hide = force ?? !el.split.classList.contains('no-sidebar');
  el.split.classList.toggle('no-sidebar', hide);
  // The keyboard isn't left in a list that's gone.
  if (hide && el.sidebar.contains(document.activeElement)) el.sidebarToggle.focus();
  listShown();
  remember('reader:sidebar', hide ? 'hidden' : 'shown');
}

/** The list over the panes, open or not, at a narrow width. */
export function toggleDrawer(open = !el.split.classList.contains('list-open')) {
  el.split.classList.toggle('list-open', open);
  listShown();
  if (open) el.filter.focus();
  else if (el.sidebar.contains(document.activeElement)) el.sidebarToggle.focus();
}

/** Whether the list can be seen: beside the panes, or over them. Work has no list beside the page. */
export function listSeen() {
  const { classList } = el.split;
  if (classList.contains('list-open')) return true;
  return !NARROW.matches && !classList.contains('no-sidebar') && !classList.contains('work-mode');
}

/**
 * Brings the list into sight for someone who asked for what's in it: over the
 * panes at a narrow width, and in Work, which is left as it is, since what's
 * being filled in shouldn't go for a look at the list; otherwise beside them.
 */
export function showList() {
  if (NARROW.matches || el.split.classList.contains('work-mode')) toggleDrawer(true);
  else toggleSidebar(false);
}

/** ☰ says whether the list is showing: beside the panes, or over them. */
function listShown() {
  el.sidebarToggle.setAttribute('aria-expanded', String(listSeen()));
}

export function toggleHelp(show = el.help.hidden) {
  el.help.hidden = !show;
  el.helpToggle.setAttribute('aria-expanded', String(show));
}

export function wireDrawer() {
  const close = () => {
    if (el.split.classList.contains('list-open')) toggleDrawer(false);
  };
  NARROW.addEventListener('change', () => {
    close();
    listShown();
  });
  el.sidebar.addEventListener('click', (e) => {
    if (e.target.closest('.file, .start-today:not([aria-disabled="true"])')) close();
  });
  el.sidebar.addEventListener('keydown', (e) => {
    // Heard before the filter clears itself on Esc: only an empty one closes the list.
    if (e.key === 'Escape' && !(e.target.matches('input') && e.target.value)) close();
  }, { capture: true });
  document.addEventListener('pointerdown', (e) => {
    if (!el.sidebar.contains(e.target) && !el.sidebarToggle.contains(e.target) && !el.todayBtn.contains(e.target)) close();
  });
  // Nor does it stay over the panes once Tab has gone on to them. Where the
  // keyboard went is known once it's there: going into the preview's frame
  // says nothing of it as it leaves.
  el.sidebar.addEventListener('focusout', () => setTimeout(() => {
    const to = document.activeElement;
    if (to && to !== document.body && !el.sidebar.contains(to) && !el.sidebarToggle.contains(to) && !el.todayBtn.contains(to)) close();
  }));
  listShown();
}

export function restoreLayout() {
  if (remembered('reader:sidebar') === 'hidden') toggleSidebar(true);
  if (remembered('reader:help') === 'shown') toggleHelp(true);
  if (chosenWork()) setWorking(true);
  deck.notes = remembered('reader:notes') === 'shown';
}

// 'read' is what work mode was called.
const chosenWork = () => ['work', 'read'].includes(remembered('reader:mode'));

/**
 * The mode the file `text` opens in, by its `type:` (static/markdown.js): a
 * workbook in Work, to fill in; slides in Edit, to write, with Present
 * beside it; and a document in whichever was last chosen. Opening a file
 * isn't choosing one, so it's not remembered, and the keyboard stays where
 * it is. The caller draws the file.
 */
export function openIn(text) {
  const type = typeOf(frontMatter(text.replace(/\r\n?/g, '\n').split('\n'))?.meta);
  setWorking(type === 'workbook' || (type === 'document' && chosenWork()), { chosen: false });
}

/**
 * Work mode: the rendered page full width, to read and to fill in, the
 * editor out of reach. A deck is a workbook there, a page at a time
 * (pages.js), opened on the page the cursor was on. `chosen` is false when
 * it's not the user who picked it: then it's neither remembered nor drawn,
 * and the editor isn't focused.
 */
export function setWorking(on, { chosen = true } = {}) {
  const changed = state.working !== on;
  state.working = on;
  // Out of Work, a wide screen has the list beside the page again.
  if (!on && !NARROW.matches) el.split.classList.remove('list-open');
  el.split.classList.toggle('work-mode', on);
  el.editor.readOnly = on || deck.open;
  el.workBtn.textContent = on ? 'Edit' : 'Work';
  el.workBtn.title = on ? 'Back to editing (⌘. or Esc)' : 'Work through it without editing (⌘.)';
  if (changed) {
    if (on) openAt(el.editor.value.slice(0, el.editor.selectionStart).split('\n').length - 1);
    if (chosen) renderNow();
  }
  if (on) {
    if (document.activeElement === el.editor) el.editor.blur();
    if (dirty()) save();
  } else if (chosen && state.current?.type === 'md' && !deck.open) {
    el.editor.focus({ preventScroll: true });
  }
  if (chosen) remember('reader:mode', on ? 'work' : 'edit');
}
