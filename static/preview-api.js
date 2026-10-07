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
 *     already shows it, so it needn't be rendered again.
 *
 *   Preview.register({ keep, restore })
 *     Each render replaces the page. `keep()` is called just before, to say
 *     what to carry over (a field being typed in, a puzzle being played);
 *     `restore(root, kept)` just after, with what it said.
 *
 *   Preview.deck
 *     Whether a slide is showing, when clicks and keys drive the deck.
 */
(() => {
  const hooks = [];
  window.Preview = {
    deck: false,
    edit(edits, opts = {}) {
      window.parent.postMessage({ type: 'edit', edits, ...opts }, '*');
    },
    register(hook) {
      hooks.push(hook);
    },
    /** For preview.js: runs `render` between the hooks' keep and restore. */
    replace(root, render) {
      const kept = hooks.map((h) => h.keep?.());
      render();
      hooks.forEach((h, i) => h.restore?.(root, kept[i]));
    },
  };
})();
