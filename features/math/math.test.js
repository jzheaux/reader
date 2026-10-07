import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { math } from './index.js';

test('math: sets operators as symbols', () => {
  assert.equal(math('recognition >> judgment'), 'recognition\u00A0\u226B judgment');
  assert.equal(math('a>=b'), 'a\u00A0\u2265 b');
  assert.equal(math('x != y, x ~= y, x <= y, x << y'), 'x\u00A0\u2260 y, x\u00A0\u2248 y, x\u00A0\u2264 y, x\u00A0\u226A y');
  assert.equal(math('a -> b <- c <-> d'), 'a\u00A0\u2192 b\u00A0\u2190 c\u00A0\u2194 d');
  assert.equal(math('self-worth - doubt * 2 +- inf .: -x'), 'self-worth \u2212 doubt\u00A0\u00D7 2\u00A0\u00B1 \u221E\u00A0\u2234 \u2212x');
});

test('math: alone on a line is displayed, and inline otherwise', () => {
  const { body } = render('math:[a >> b]\n\nso math:[a > b] here, `math:[c]`\n');
  assert.match(body, /<p class="math-display"><span class="math">a\u00A0\u226B b<\/span><\/p>/);
  assert.match(body, /so <span class="math">a\u00A0&gt; b<\/span> here, <code>math:\[c\]<\/code>/);
});
