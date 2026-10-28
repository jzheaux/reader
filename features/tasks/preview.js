/**
 * A task's checkbox rewrites its `[ ]`, and a radio button its list's
 * `( )`s, as one edit; the re-render that follows is what makes the change
 * stick. Each box knows its line checked and unchecked (`data-on`,
 * `data-off`), and a box with stages its line at each (`data-lines`): a
 * click fills the next stage, or empties a full box, and a shift-click
 * goes back one. A reset button clears every box on its lines, and a log
 * button beside it adds a heading for today, with the multiple picked. Another
 * feature can have a box done by sending it, or its list item, a
 * `preview:complete`: a plain box is ticked, a staged one filled all the way.
 * Runs in the preview frame.
 */
(() => {
  const boxLine = (b, on) => {
    const line = Number(b.dataset.line);
    // `defaultChecked` is what the file said when the page was drawn.
    return { from: line, to: line + 1, before: [b.defaultChecked ? b.dataset.on : b.dataset.off], after: [on ? b.dataset.on : b.dataset.off] };
  };
  const stageLine = (b, to) => {
    const line = Number(b.dataset.line);
    const lines = JSON.parse(b.dataset.lines);
    return { from: line, to: line + 1, before: [lines[Number(b.dataset.stage)]], after: [lines[to]] };
  };
  /** Until the next render, the page is what the file says. */
  const setStage = (b, to) => {
    b.dataset.stage = String(to);
    [...b.children].forEach((pip, k) => pip.classList.toggle('on', k < to));
    const n = b.children.length;
    b.setAttribute('aria-checked', to === n ? 'true' : to ? 'mixed' : 'false');
  };

  document.addEventListener('change', (e) => {
    const box = e.target;
    // A field's choices share a line, and the field writes it (fields/preview.js).
    if (!box.matches || !box.matches('input.task-box, input.choice-box') || box.closest('.field')) return;
    const group = box.type === 'radio'
      ? [...document.querySelectorAll('input.choice-box')].filter((b) => b.name === box.name)
      : [box];
    const edits = group.map((b) => boxLine(b, b === box ? box.checked : false))
      .filter((x) => x.before[0] !== x.after[0]);
    for (const b of group) b.defaultChecked = b.checked;
    if (edits.length) Preview.edit(edits, { undo: true });
  });

  // Asked of a box, or of the list item it begins: done, if it isn't. Its
  // edit goes up with the rest of the turn's, as one undo (preview-api.js).
  document.addEventListener('preview:complete', (e) => {
    const at = e.target;
    const own = (sel) => (at.matches?.(sel) ? at : at.querySelector?.(`:scope > ${sel}, :scope > p > ${sel}`));
    const staged = own('.stage-box');
    const plain = own('input.task-box');
    if (staged) {
      const n = staged.children.length;
      if (Number(staged.dataset.stage) === n) return;
      Preview.edit([stageLine(staged, n)], { undo: true });
      setStage(staged, n);
    } else if (plain && !plain.defaultChecked && !plain.closest('.field')) {
      Preview.edit([boxLine(plain, true)], { undo: true });
      plain.checked = plain.defaultChecked = true;
    }
  });

  document.addEventListener('click', (e) => {
    const box = e.target.closest?.('.stage-box');
    if (box) {
      const stage = Number(box.dataset.stage);
      const n = box.children.length;
      const to = e.shiftKey ? Math.max(0, stage - 1) : stage === n ? 0 : stage + 1;
      if (to === stage) return;
      Preview.edit([stageLine(box, to)], { undo: true });
      setStage(box, to);
      return;
    }
    const log = e.target.closest?.('.task-log');
    if (log) {
      const at = Number(log.dataset.at);
      const d = new Date();
      const today = [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
      const multiplier = log.dataset.multiplier && document.querySelector(`.multiplier[data-multiplier="${log.dataset.multiplier}"]`);
      const by = multiplier?.querySelector('.multiply[aria-pressed="true"]:not([data-by="1"])')?.textContent;
      const heading = `${'#'.repeat(Number(log.dataset.level))} date:${today}[]${by ? ` · ${by}` : ''}`;
      Preview.edit([{ from: at, to: at, before: [], after: ['', heading] }], { undo: true });
      return;
    }
    const reset = e.target.closest?.('.task-reset');
    if (!reset) return;
    const from = Number(reset.dataset.from);
    const to = reset.dataset.to ? Number(reset.dataset.to) : Infinity;
    const within = (b) => Number(b.dataset.line) >= from && Number(b.dataset.line) < to && !b.closest('.field');
    const edits = [];
    for (const b of document.querySelectorAll('input.task-box, input.choice-box')) {
      if (within(b) && b.defaultChecked) {
        edits.push(boxLine(b, false));
        b.checked = b.defaultChecked = false;
      }
    }
    for (const b of document.querySelectorAll('.stage-box')) {
      if (within(b) && Number(b.dataset.stage)) {
        edits.push(stageLine(b, 0));
        setStage(b, 0);
      }
    }
    if (edits.length) Preview.edit(edits, { undo: true });
  });
})();
