import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';

test('@ lines become form fields that know their line and value', () => {
  const { body } = render('# Form\n\n@ My Name: Josh\n@ Date:\n@ Time: 10:30 -> *noon* <b>\n');
  assert.match(body, /<span class="field" data-line="2" data-text="@ My Name: Josh" data-head="@ My Name:"><span class="field-label">My Name<\/span><span class="field-value" data-value="Josh">Josh<\/span><\/span>/);
  assert.match(body, /data-line="3" data-text="@ Date:" data-head="@ Date:"><span class="field-label">Date<\/span><span class="field-value" data-value=""><\/span>/);
  assert.match(body, /data-value="10:30 -&gt; \*noon\* &lt;b&gt;">10:30 -&gt; \*noon\* &lt;b&gt;</);
});

test('@ lines with more colons are that many lines tall', () => {
  const { body } = render('@ Notes ::: it went well\n@ Bio::\n@ Name: Josh\n');
  assert.match(body, /<span class="field" data-line="0" data-text="@ Notes ::: it went well" data-head="@ Notes :::" data-lines="3" style="--lines: 3"><span class="field-label">Notes<\/span><span class="field-value" data-value="it went well">/);
  assert.match(body, /data-line="1" [^>]* data-lines="2" style="--lines: 2"><span class="field-label">Bio<\/span><span class="field-value" data-value="">/);
  assert.match(body, /<span class="field" data-line="2" [^>]*><span class="field-label">Name</);
});

test('@ lines in code, indented, without a label or mid-sentence are left as typed', () => {
  const { body } = render('```\n@ No: code\n```\n\nhello @ there: x\n\n @ Indented: x\n\n@ : empty\n\n@mention: hi\n');
  assert.doesNotMatch(body, /class="field"/);
  assert.match(body, /@ No: code/);
  assert.match(body, /hello @ there: x/);
  assert.match(body, /@mention: hi/);
});

test('a field carried into an aside keeps its line', () => {
  const { body } = render('~ a thought\n@ Name: x\n', { line: 3 });
  assert.match(body, /gm-aside-cell[\s\S]*<span class="field" data-line="4" data-text="@ Name: x" data-head="@ Name:">/);
});

test('a field in a ::: block is styled with it', () => {
  const { body } = render('::: red\n@ Name: x\n:::\n');
  assert.match(body, /<p style="color: red"><span class="field" data-line="1" /);
});

test('the stylesheet comes with the feature', () => {
  assert.match(render('@ A: b\n').css, /\.field \{/);
});
