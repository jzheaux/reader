/**
 * An ingredient named in a step: hovering or focusing the word shows its
 * item, amounts as multiplied, and Enter or Space on it shows it or puts it
 * away. Those named in what's current on the page, `[aria-current="step"]`,
 * are lit, and so are their items in the list, each time `preview:current`
 * says it changed. A step ticked done, a list item marked as one to follow
 * (`data-steps`), that's the last to name an ingredient marks it used: its
 * item is sent `preview:complete`, which tasks answers in the same edit, as
 * one undo. Any other item naming it, as a shopping list's might, neither
 * uses it up nor holds it back. Runs in the preview frame.
 */
(() => {
  const itemOf = (use) => document.querySelector(`li.ingredient[data-recipe="${use.dataset.recipe}"][data-ingredient~="${CSS.escape(use.dataset.ingredient)}"]`);

  document.addEventListener('preview:current', () => {
    for (const lit of document.querySelectorAll('.ingredient-use.lit, li.ingredient.lit')) lit.classList.remove('lit');
    for (const current of document.querySelectorAll('[aria-current="step"]')) {
      for (const use of current.querySelectorAll('.ingredient-use')) {
        use.classList.add('lit');
        itemOf(use)?.classList.add('lit');
      }
    }
  });

  // The item, shown by the word, and described by it.
  const pop = document.createElement('div');
  pop.className = 'ingredient-pop';
  pop.id = 'ingredient-pop';
  pop.setAttribute('role', 'tooltip');
  pop.hidden = true;
  let showing = null;

  function show(use) {
    const item = itemOf(use);
    if (!item) return;
    if (showing && showing !== use) showing.removeAttribute('aria-describedby');
    showing = use;
    const copy = item.cloneNode(true);
    copy.querySelectorAll('input, button, .stage-name, ul, ol').forEach((n) => n.remove());
    pop.textContent = copy.textContent.replace(/\s+/g, ' ').trim();
    // Outside <body>, which every render replaces.
    if (!pop.isConnected) document.documentElement.append(pop);
    pop.hidden = false;
    use.setAttribute('aria-describedby', pop.id);
    const r = use.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8))}px`;
    pop.style.top = `${r.bottom + 6}px`;
  }
  function hide() {
    showing?.removeAttribute('aria-describedby');
    showing = null;
    pop.hidden = true;
  }
  // It stays while the pointer is on the word or on it, so it can be read
  // at any size; the gap between them is the popup's too (ingredients.css).
  document.addEventListener('mouseover', (e) => {
    if (pop.contains(e.target)) return;
    const use = e.target.closest?.('.ingredient-use');
    if (use && use !== showing) show(use);
    else if (!use && showing) hide();
  });
  document.addEventListener('focusin', (e) => {
    const use = e.target.closest?.('.ingredient-use');
    if (use) show(use);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && showing) hide();
    // The word is a button: Enter or Space shows its item, or puts it away.
    const use = e.target.closest?.('.ingredient-use');
    if (use && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (showing === use) hide();
      else show(use);
    }
  });
  window.addEventListener('scroll', hide, { passive: true });
  Preview.register({ restore: hide });

  // A step's own box ticked: each ingredient it names that no step still to
  // do names is used.
  const ownBox = (li) => li?.querySelector(':scope > input[type=checkbox], :scope > p > input[type=checkbox]');
  document.addEventListener('change', (e) => {
    const li = e.target.closest?.('li[data-steps]');
    if (!li || ownBox(li) !== e.target || !e.target.checked) return;
    const pending = (use) => {
      const other = use.closest('li[data-steps]');
      return other && other !== li && ownBox(other) && !ownBox(other).checked;
    };
    const all = [...document.querySelectorAll('.ingredient-use')];
    const items = new Set();
    for (const use of li.querySelectorAll('.ingredient-use')) {
      const same = all.filter((u) => u.dataset.recipe === use.dataset.recipe && u.dataset.ingredient === use.dataset.ingredient);
      if (!same.some(pending)) items.add(itemOf(use));
    }
    for (const item of items) item?.dispatchEvent(new Event('preview:complete', { bubbles: true }));
  });
})();
