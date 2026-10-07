/**
 * A task's checkbox rewrites its `[ ]`, and a radio button its list's
 * `( )`s, as one edit; the re-render that follows is what makes the change
 * stick. Each box knows its line checked and unchecked (`data-on`,
 * `data-off`). Runs in the preview frame.
 */
(() => {
  const boxLine = (b, on) => {
    const line = Number(b.dataset.line);
    // `defaultChecked` is what the file said when the page was drawn.
    return { from: line, to: line + 1, before: [b.defaultChecked ? b.dataset.on : b.dataset.off], after: [on ? b.dataset.on : b.dataset.off] };
  };
  document.addEventListener('change', (e) => {
    const box = e.target;
    if (!box.matches || !box.matches('input.task-box, input.choice-box')) return;
    const group = box.type === 'radio'
      ? [...document.querySelectorAll('input.choice-box')].filter((b) => b.name === box.name)
      : [box];
    const edits = group.map((b) => boxLine(b, b === box ? box.checked : false))
      .filter((x) => x.before[0] !== x.after[0]);
    // Until the next render, the page is what the file says.
    for (const b of group) b.defaultChecked = b.checked;
    if (edits.length) Preview.edit(edits, { undo: true });
  });
})();
