/**
 * A card's label (G, B or T) marks its discussion done, or not done again
 * (a Try's, that it's been tried):
 * a click, or Enter or Space on it, writes its line with `[x]` or without
 * (`data-on`, `data-off`); the re-render that follows fades the card.
 * Where the page can't be worked (`Preview.workable`), as on a slide, it
 * takes neither. Runs in the preview frame.
 */
(() => {
  const toggle = (label) => {
    const line = Number(label.dataset.line);
    const done = label.closest('li').classList.contains('qa-done');
    const [before, after] = done ? [label.dataset.on, label.dataset.off] : [label.dataset.off, label.dataset.on];
    if (before !== after) Preview.edit([{ from: line, to: line + 1, before: [before], after: [after] }], { undo: true });
  };
  document.addEventListener('click', (e) => {
    const label = Preview.workable && e.target.closest && e.target.closest('.qa-toggle');
    if (label) toggle(label);
  });
  document.addEventListener('keydown', (e) => {
    const label = Preview.workable && e.target.closest && e.target.closest('.qa-toggle');
    if (!label || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    toggle(label);
  });
})();
