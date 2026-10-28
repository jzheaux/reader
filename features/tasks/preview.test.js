import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { preview, settle } from '../../test/dom.js';

/**
 * The preview showing `markdown`: `await edits()` is what it has asked to
 * be written since last asked, by the end of the turn, each ask an array of
 * edits.
 */
async function page(markdown) {
  const p = preview();
  // Today, as far as the page knows.
  p.window.Date = class extends Date {
    constructor(...at) { super(...(at.length ? at : [2026, 2, 4, 12])); }
  };
  p.show(render(markdown).body);
  const edits = async () => {
    await settle();
    return p.posted.splice(0).filter((m) => m.type === 'edit').map((m) => {
      assert.equal(m.undo, true, 'an edit the editor can undo');
      return m.edits.map((e) => [e.from, e.before.join('\n'), e.after.join('\n')]);
    });
  };
  const $ = (sel) => p.document.querySelector(sel);
  const $$ = (sel) => [...p.document.querySelectorAll(sel)];
  const click = (node, keys = {}) => node.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true, cancelable: true, ...keys }));
  await edits();
  return { ...p, edits, $, $$, click };
}

const STAGED = '---\nmultibox:\n  stages: have, prepped, used\n---\n\n* [x][ ][ ] onion\n';

test('a click on a staged box fills its next stage, and on a full one empties it', async () => {
  const { $, click, edits } = await page(STAGED);
  const box = $('.stage-box');
  click(box);
  assert.deepEqual(await edits(), [[[5, '* [x][ ][ ] onion', '* [x][x][ ] onion']]]);
  assert.equal(box.dataset.stage, '2');
  assert.equal(box.getAttribute('aria-checked'), 'mixed');
  assert.deepEqual([...box.children].map((pip) => pip.classList.contains('on')), [true, true, false]);
  click(box);
  assert.deepEqual(await edits(), [[[5, '* [x][x][ ] onion', '* [x][x][x] onion']]]);
  assert.equal(box.getAttribute('aria-checked'), 'true');
  click(box);
  assert.deepEqual(await edits(), [[[5, '* [x][x][x] onion', '* [ ][ ][ ] onion']]]);
  assert.equal(box.getAttribute('aria-checked'), 'false');
});

test('a shift-click on a staged box goes back a stage, and does nothing on an empty one', async () => {
  const { $, click, edits } = await page(STAGED);
  const box = $('.stage-box');
  click(box, { shiftKey: true });
  assert.deepEqual(await edits(), [[[5, '* [x][ ][ ] onion', '* [ ][ ][ ] onion']]]);
  click(box, { shiftKey: true });
  assert.deepEqual(await edits(), []);
  assert.equal(box.dataset.stage, '0');
});

test('Start over clears every box in its section, plain, staged or a choice, as one edit', async () => {
  const { $, $$, click, edits } = await page([
    '## Akara', 'reset:[]', '',
    '* [x] peas', '* [ ] chili', '* [x][x][ ] onion', '',
    '- ( ) small', '- (x) large', '',
    '## Next', '* [x] stays',
  ].join('\n'));
  click($('.task-reset'));
  assert.deepEqual(await edits(), [[
    [3, '* [x] peas', '* [ ] peas'],
    [8, '- (x) large', '- ( ) large'],
    [5, '* [x][x][ ] onion', '* [ ][ ][ ] onion'],
  ]]);
  assert.deepEqual($$('input').map((b) => b.checked), [false, false, false, false, true]);
  assert.equal($('.stage-box').dataset.stage, '0');
  // Nothing left to clear, nothing to write.
  click($('.task-reset'));
  assert.deepEqual(await edits(), []);
});

test('a box, or the list item it begins, sent preview:complete is ticked, or filled all the way, and one done already is left', async () => {
  const { window, $$, edits } = await page([
    '---', 'multibox:', '  stages: have, prepped, used', '---', '',
    '* [ ] peas', '* [x][ ][ ] onion', '* [x] chili',
  ].join('\n'));
  const complete = (node) => node.dispatchEvent(new window.Event('preview:complete', { bubbles: true }));
  const [peas, onion, chili] = $$('li');
  complete(peas.querySelector('.task-box'));
  complete(onion);
  complete(chili);
  assert.deepEqual(await edits(), [[
    [5, '* [ ] peas', '* [x] peas'],
    [6, '* [x][ ][ ] onion', '* [x][x][x] onion'],
  ]]);
  assert.equal(peas.querySelector('.task-box').checked, true);
  assert.equal(onion.querySelector('.stage-box').getAttribute('aria-checked'), 'true');
  complete(onion);
  complete(peas);
  assert.deepEqual(await edits(), []);
});

const LOGGED = [
  '## Akara', 'Serves count:4', 'multiplier:[]', 'reset:[]', '',
  '### Log', '#### date:2026-10-18[]', 'Good (Ana): fine', '',
  '## Next',
].join('\n');

test('Log today adds a heading for today after the log\'s last entry, with the multiple the recipe is at', async () => {
  const { $, $$, click, edits } = await page(LOGGED);
  click($('.task-log'));
  assert.deepEqual(await edits(), [[[8, '', '\n#### date:2026-03-04[]']]]);
  click($$('.multiply').find((b) => b.textContent === '2×'));
  await edits();
  click($('.task-log'));
  assert.deepEqual(await edits(), [[[8, '', '\n#### date:2026-03-04[] · 2×']]]);
  // Back at 1×, it's as written.
  click($$('.multiply').find((b) => b.textContent === '1×'));
  await edits();
  click($('.task-log'));
  assert.deepEqual(await edits(), [[[8, '', '\n#### date:2026-03-04[]']]]);
});
