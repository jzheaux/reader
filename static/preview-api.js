/**
 * What the preview frame offers the scripts drawn into it: a feature's
 * `preview.js` (served from its directory in features/) and each kind of
 * puzzle. Loaded before them; static/preview.js, loaded after, puts the
 * rendered document in place and calls the hooks.
 *
 *   Preview.edit(edits, { undo, drawn })
 *     Edits to the file go up as lines to replace: lines `from` up to `to`,
 *     which read `before`, become `after` (see edits.js). `undo` asks for
 *     the edit to go on the editor's undo stack; `drawn` says the page
 *     already shows it, so it needn't be rendered again. Edits asked for
 *     while one click or key is handled are held to the end of the turn (a
 *     microtask) and go up together, those with the same options as one
 *     edit and one undo. So features that answer the same click (a step
 *     done, the ingredient it uses up) needn't know of each other.
 *
 *   Preview.flush()
 *     Sends the edits held so far now, not at the end of the turn.
 *
 *   Preview.register({ keep, restore, drawn })
 *     Each render replaces the page. `keep()` is called just before, to say
 *     what to carry over (a field being typed in, a puzzle being played);
 *     `restore(root, kept)` just after, with what it said. `drawn()` says
 *     what the feature drew on the page, under its name, for a page that
 *     will have nothing to draw it (an export): `{ mermaid: { text: svg } }`.
 *
 *   Preview.wait(promise)
 *     For what's drawn after a render, settling once it's in place (a
 *     diagram): a slide is fitted again then, and a measurement of it
 *     waits for it.
 *
 *   Preview.deck
 *     Whether a slide is showing, when clicks and keys drive the deck.
 *
 *   Preview.workable
 *     Whether the page can be worked here: a blank filled in, a box
 *     ticked, a choice or a date picked, a card marked done, a step lit.
 *     It's the frame's word for what workable() in features/blank.js drew
 *     the page by, and the one every feature reads before it takes a click
 *     or a key. Each render sets it, false on a slide, which the deck keeps
 *     shut; it may be set again while the page is showing, and what's done
 *     after goes by it. While it's false, <html> is marked `unworkable`, so
 *     what can't be worked doesn't look as if it could.
 */
(() => {
  const hooks = [];
  const pending = new Set();
  // The edits asked for in this turn, under their options, in the order asked.
  let held = null;
  const flush = () => {
    const sending = held;
    held = null;
    for (const { edits, opts } of sending?.values() ?? []) window.parent.postMessage({ type: 'edit', edits, ...opts }, '*');
  };
  let workable = true;
  window.Preview = {
    deck: false,
    get workable() {
      return workable;
    },
    set workable(on) {
      workable = Boolean(on);
      document.documentElement.classList.toggle('unworkable', !workable);
    },
    edit(edits, opts = {}) {
      if (!held) {
        held = new Map();
        queueMicrotask(flush);
      }
      const key = JSON.stringify(opts);
      if (held.has(key)) held.get(key).edits.push(...edits);
      else held.set(key, { edits: [...edits], opts });
    },
    flush,
    register(hook) {
      hooks.push(hook);
    },
    wait(promise) {
      const p = Promise.resolve(promise).finally(() => {
        pending.delete(p);
        window.dispatchEvent(new Event('preview:drawn'));
      });
      pending.add(p);
    },
    /** For preview.js: what's still being drawn. */
    pending: () => [...pending],
    /** For preview.js: what every feature drew on the page. */
    drawn: () => Object.assign({}, ...hooks.map((h) => h.drawn?.())),
    /** For preview.js: runs `render` between the hooks' keep and restore. */
    replace(root, render) {
      const kept = hooks.map((h) => h.keep?.());
      render();
      hooks.forEach((h, i) => h.restore?.(root, kept[i]));
    },
  };
})();
