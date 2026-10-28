/**
 * A form field (`@ Label: value`, a line of blank for each colon): a click
 * on its label, its blank, or beside them opens the blank for typing, the
 * text wrapping onto more lines as it needs them, as does the keyboard
 * reaching the blank. Enter, or clicking away, writes the value into the
 * file; Esc puts it back as it was, both leaving the keyboard on the blank,
 * where Enter opens it again; Tab and Shift-Tab write it and move to the
 * next field or the one before. A field of choices writes its line as it
 * reads with the one picked. A field in a sentence (`[@ what goes here:
 * answer]`) writes its answer into its place on the line, moving along the
 * others after it. Runs in the preview frame.
 */
(() => {
  let editing = null;
  let resting = null;   // a blank the keyboard is put back on, not to open again

  const fieldLabel = (f) => f.querySelector('.field-label')?.textContent ?? '';
  const fieldAt = (line, label, start) => [...document.querySelectorAll('.field')]
    .find((f) => f.dataset.line === String(line) && fieldLabel(f) === label && f.dataset.start === start);
  /** Where `field` is, to find it again after a re-render. */
  const placeOf = (field) => ({ line: field.dataset.line, label: fieldLabel(field), at: field.dataset.start });

  /** `field`'s line as written with `value` in it, the fields beside it told where they are now. */
  function written(field, value) {
    if (field.dataset.start === undefined) return value ? `${field.dataset.head} ${value}` : field.dataset.head;
    const was = field.dataset.text;
    const start = Number(field.dataset.start);
    const end = Number(field.dataset.end);
    const piece = value ? `${field.dataset.head}: ${value}]` : `${field.dataset.head}]`;
    const now = was.slice(0, start) + piece + was.slice(end);
    const moved = piece.length - (end - start);
    for (const f of document.querySelectorAll(`.field[data-line="${field.dataset.line}"][data-start]`)) {
      const at = Number(f.dataset.start);
      if (f === field) f.dataset.end = String(start + piece.length);
      else if (at > start) {
        f.dataset.start = String(at + moved);
        f.dataset.end = String(Number(f.dataset.end) + moved);
      }
      f.dataset.text = now;
    }
    return now;
  }

  function openField(field, { value, start, end } = {}) {
    const slot = field.querySelector('.field-value');
    if (!slot || slot.querySelector('textarea')) return;
    editing?.close(true);
    const before = slot.dataset.value ?? '';
    const input = document.createElement('textarea');
    input.value = value ?? before;
    input.rows = 1;
    input.setAttribute('aria-label', slot.getAttribute('aria-label') ?? fieldLabel(field));
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
    const close = (commit, { stay = false } = {}) => {
      if (done) return;
      done = true;
      if (editing?.input === input) editing = null;
      let after = commit ? input.value.replace(/\s+/g, ' ').trim() : before;
      // In a sentence, a `]` would end the field early: brackets go round.
      if (field.dataset.start !== undefined) after = after.replace(/\[/g, '(').replace(/\]/g, ')');
      slot.textContent = after;
      slot.dataset.value = after;
      if (stay && slot.tabIndex >= 0) {
        resting = slot;
        slot.focus();
      }
      if (after !== before) {
        // The line as written, with the new value after its colons.
        const line = Number(field.dataset.line);
        const was = field.dataset.text;
        const now = written(field, after);
        field.dataset.text = now;
        Preview.edit([{ from: line, to: line + 1, before: [was], after: [now] }]);
      }
    };
    // A re-render is about to replace the field: let it go quietly and say
    // how to open it again.
    const keep = () => {
      done = true;
      editing = null;
      return { ...placeOf(field), value: input.value, start: input.selectionStart, end: input.selectionEnd };
    };
    editing = { input, close, keep };

    input.addEventListener('keydown', (e) => {
      if (!['Enter', 'Escape', 'Tab'].includes(e.key) || e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      const all = [...document.querySelectorAll('.field:not([data-choices])')];
      const next = e.key === 'Tab' && all[all.indexOf(field) + (e.shiftKey ? -1 : 1)];
      close(e.key !== 'Escape', { stay: !next });
      if (next) openField(next);
    });
    input.addEventListener('blur', () => close(true));
  }

  document.addEventListener('change', (e) => {
    const field = e.target.matches?.('.field-choice > input') && e.target.closest('.field');
    if (!field) return;
    const line = Number(field.dataset.line);
    const was = field.dataset.text;
    const now = e.target.dataset.on;
    field.dataset.text = now;
    if (now !== was) Preview.edit([{ from: line, to: line + 1, before: [was], after: [now] }], { undo: true });
  });

  document.addEventListener('focusin', (e) => {
    const slot = e.target.matches?.('.field-value') && e.target;
    if (!slot || slot === resting) return;
    const f = Preview.workable && slot.closest('.field:not([data-choices])');
    if (f) openField(f);
  });
  document.addEventListener('focusout', (e) => { if (e.target === resting) resting = null; });
  // Enter opens again the blank the keyboard was left on.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target !== resting || !Preview.workable) return;
    e.preventDefault();
    resting = null;
    openField(e.target.closest('.field'));
  });

  document.addEventListener('click', (e) => {
    const f = Preview.workable && e.target.closest && e.target.closest('.field:not([data-choices])');
    if (f && !(e.target instanceof HTMLTextAreaElement)) openField(f);
  });

  // A field being filled in stays open through a re-render, with what's
  // been typed so far; one just written keeps the keyboard, as written
  // ones bring a render.
  Preview.register({
    keep: () => editing?.keep()
      ?? (resting && document.activeElement === resting ? { ...placeOf(resting.closest('.field')), resting: true } : undefined),
    restore: (root, filling) => {
      if (!filling) return;
      const field = fieldAt(filling.line, filling.label, filling.at);
      if (!field) return;
      if (!filling.resting) return openField(field, filling);
      resting = field.querySelector('.field-value');
      resting?.focus({ preventScroll: true });
    },
  });
})();
