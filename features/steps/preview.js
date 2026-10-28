/**
 * Following steps: in each group of them (`data-steps`), the step being
 * worked on is lit, once any is done or one is clicked. It's the first
 * not done, or the one clicked; marking it done lights the next not done
 * after it. `j` and `k` light the next and the one before, and `x` marks
 * the lit one done, or not, when the page has the keys and no control on it
 * does (but a step's own box), so they don't stand in for a key a control
 * wants. The lit step is the current one, and each key says where it left
 * the steps. What's lit is only the page's, not the file's, and holds
 * across renders.
 *
 * While steps are under way -- begun and not all done -- the page around
 * the frame is asked to keep the screen awake (static/awake.js): hands
 * are busy. Runs in the preview frame.
 */
(() => {
  // A group's lit step, by its index, once one is clicked or done.
  const lit = new Map();
  let awake = false;

  // What a key did, for a screen reader, said outside <body>: marking a
  // step done brings a render, which replaces the page.
  const said = document.createElement('div');
  said.className = 'steps-said';
  said.setAttribute('aria-live', 'polite');
  const say = (text) => {
    if (!said.isConnected) document.documentElement.append(said);
    // The same again is still heard.
    said.textContent = said.textContent === text ? `${text}\u00a0` : text;
  };
  const words = (li) => {
    const copy = li.cloneNode(true);
    copy.querySelectorAll('ol, ul, input, button').forEach((n) => n.remove());
    return copy.textContent.replace(/\s+/g, ' ').trim();
  };
  const tell = (g, k) => {
    const steps = groups().get(g);
    const li = steps?.[k];
    if (li) say(`Step ${k + 1} of ${steps.length}${done(li) ? ', done' : ''}: ${words(li)}`);
  };

  const groups = (root = document) => {
    const found = new Map();
    for (const li of root.querySelectorAll('li.step[data-steps]')) {
      const g = li.dataset.steps;
      if (!found.has(g)) found.set(g, []);
      found.get(g).push(li);
    }
    return found;
  };
  const done = (li) => li.classList.contains('step-done');
  const boxOf = (li) => li.querySelector(':scope > .task-box, :scope > p > .task-box');
  /** The first step not done from `k` on, or else from the start; -1 for none. */
  const undone = (steps, k = 0) => {
    const after = steps.findIndex((li, j) => j >= k && !done(li));
    return after >= 0 ? after : steps.findIndex((li) => !done(li));
  };

  function show(root = document) {
    const all = groups(root);
    for (const g of lit.keys()) if (!all.has(g)) lit.delete(g);
    let underWay = false;
    for (const [g, steps] of all) {
      const begun = lit.has(g) || steps.some(done);
      const at = lit.has(g) ? lit.get(g) : begun ? undone(steps) : -1;
      steps.forEach((li, k) => {
        li.classList.toggle('step-current', k === at);
        if (k === at) li.setAttribute('aria-current', 'step');
        else li.removeAttribute('aria-current');
      });
      if (begun && !steps.every(done)) underWay = true;
    }
    // What's current on the page changed, for any feature that follows it:
    // the lit steps carry `aria-current="step"`.
    document.dispatchEvent(new Event('preview:current'));
    if (underWay !== awake) {
      awake = underWay;
      window.parent.postMessage({ type: 'awake', on: awake }, '*');
    }
  }

  const place = (li) => {
    const g = li.dataset.steps;
    return { g, steps: groups().get(g), k: groups().get(g).indexOf(li) };
  };

  function light(g, k, scroll) {
    lit.set(g, k);
    show();
    if (scroll) groups().get(g)?.[k]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // Marking a step done (or not), before the render that follows.
  document.addEventListener('change', (e) => {
    const li = e.target.closest?.('li.step');
    if (!li || boxOf(li) !== e.target) return;
    li.classList.toggle('step-done', e.target.checked);
    const { g, steps, k } = place(li);
    if (!e.target.checked) light(g, k);
    else {
      const next = undone(steps, k + 1);
      if (next >= 0) light(g, next);
      else {
        lit.delete(g);
        show();
      }
    }
  });

  document.addEventListener('click', (e) => {
    // Starting a section over starts its steps over (tasks/preview.js).
    const reset = e.target.closest?.('.task-reset');
    if (reset) {
      const from = Number(reset.dataset.from);
      const to = reset.dataset.to ? Number(reset.dataset.to) : Infinity;
      const within = (g) => Number(g) >= from && Number(g) < to;
      for (const g of [...lit.keys()]) if (within(g)) lit.delete(g);
      for (const li of document.querySelectorAll('li.step-done')) if (within(li.dataset.steps)) li.classList.remove('step-done');
      show();
      return;
    }
    const li = e.target.closest?.('li.step');
    if (!li || !Preview.workable || e.target.closest('a[href], input, button, .field, .def-use')) return;
    // Text being selected isn't a click on the step.
    if (String(window.getSelection?.() ?? '')) return;
    const { g, k } = place(li);
    light(g, k);
  });

  /** The group the keys move in: the one lit, or else the first. */
  const keyed = () => {
    const all = groups();
    const current = document.querySelector('li.step-current');
    const g = current?.dataset.steps ?? all.keys().next().value;
    return g == null ? null : { g, steps: all.get(g), k: current ? all.get(g).indexOf(current) : -1 };
  };

  /** Whether a key pressed on `t` is the steps': on the page itself, or a step's own box. */
  const free = (t) => t === document.body || t === document.documentElement
    || (t.matches?.('.task-box') && boxOf(t.closest('li.step') ?? t) === t);

  document.addEventListener('keydown', (e) => {
    if (!Preview.workable || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    if (!['j', 'k', 'x'].includes(e.key) || !free(e.target)) return;
    const at = keyed();
    if (!at) return;
    e.preventDefault();
    const { g, steps, k } = at;
    if (e.key === 'x') {
      if (k < 0) return;
      const box = boxOf(steps[k]);
      box?.click();
      // The step done, and the one lit after it.
      const next = keyed();
      if (box) say(`Step ${k + 1} ${box.checked ? 'done' : 'not done'}.${next && next.k >= 0 && next.k !== k ? ` Step ${next.k + 1} of ${steps.length}: ${words(steps[next.k])}` : ''}`);
      return;
    }
    const to = e.key === 'j' ? Math.min(steps.length - 1, k + 1) : Math.max(0, k - 1);
    light(g, to, true);
    tell(g, to);
  });

  Preview.register({ restore: (root) => show(root) });
  show();
})();
