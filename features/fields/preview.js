/**
 * A form field (`@ Label: value`, a line of blank for each colon): a click
 * on its label, its blank, or beside them opens the blank for typing, the
 * text wrapping onto more lines as it needs them. Enter, or clicking away,
 * writes the value into the file; Esc puts it back as it was; Tab and
 * Shift-Tab write it and move to the next field or the one before. Runs in
 * the preview frame.
 */
(() => {
  let editing = null;

  const fieldLabel = (f) => f.querySelector('.field-label')?.textContent ?? '';
  const fieldAt = (line, label) => [...document.querySelectorAll('.field')]
    .find((f) => f.dataset.line === String(line) && fieldLabel(f) === label);

  function openField(field, { value, start, end } = {}) {
    const slot = field.querySelector('.field-value');
    if (!slot || slot.querySelector('textarea')) return;
    editing?.close(true);
    const before = slot.dataset.value ?? '';
    const input = document.createElement('textarea');
    input.value = value ?? before;
    input.rows = 1;
    input.setAttribute('aria-label', fieldLabel(field));
    input.spellcheck = false;
    slot.replaceChildren(input);
    const fit = () => {
      input.style.height = 'auto';
      input.style.height = `${input.scrollHeight}px`;
    };
    fit();
    input.addEventListener('input', fit);
    input.focus();
    input.setSelectionRange(start ?? input.value.length, end ?? input.value.length);

    let done = false;
    const close = (commit) => {
      if (done) return;
      done = true;
      if (editing?.input === input) editing = null;
      const after = commit ? input.value.replace(/\s+/g, ' ').trim() : before;
      slot.textContent = after;
      slot.dataset.value = after;
      if (after !== before) {
        // The line as written, with the new value after its colons.
        const line = Number(field.dataset.line);
        const was = field.dataset.text;
        const now = after ? `${field.dataset.head} ${after}` : field.dataset.head;
        field.dataset.text = now;
        Preview.edit([{ from: line, to: line + 1, before: [was], after: [now] }]);
      }
    };
    // A re-render is about to replace the field: let it go quietly and say
    // how to open it again.
    const keep = () => {
      done = true;
      editing = null;
      return {
        line: field.dataset.line, label: fieldLabel(field),
        value: input.value, start: input.selectionStart, end: input.selectionEnd,
      };
    };
    editing = { input, close, keep };

    input.addEventListener('keydown', (e) => {
      if (!['Enter', 'Escape', 'Tab'].includes(e.key) || e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      close(e.key !== 'Escape');
      if (e.key !== 'Tab') return;
      const all = [...document.querySelectorAll('.field')];
      const next = all[all.indexOf(field) + (e.shiftKey ? -1 : 1)];
      if (next) openField(next);
    });
    input.addEventListener('blur', () => close(true));
  }

  document.addEventListener('click', (e) => {
    const f = !Preview.deck && e.target.closest && e.target.closest('.field');
    if (f && !(e.target instanceof HTMLTextAreaElement)) openField(f);
  });

  // A field being filled in stays open through a re-render, with what's
  // been typed so far.
  Preview.register({
    keep: () => editing?.keep(),
    restore: (root, filling) => {
      if (!filling) return;
      const field = fieldAt(filling.line, filling.label);
      if (field) openField(field, filling);
    },
  });
})();
