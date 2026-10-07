import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, expand } from '../src/render.js';

test('rfc: links to the RFC Editor', () => {
  assert.equal(expand('rfc:9110[]'), '[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)');
  assert.equal(
    expand('rfc:9110#section-15.5[]'),
    '[RFC 9110 §15.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5)',
  );
  assert.equal(
    expand('rfc:6749#appendix-A[]'),
    '[RFC 6749 Appendix A](https://www.rfc-editor.org/rfc/rfc6749.html#appendix-A)',
  );
  assert.equal(expand('rfc:6749[OAuth 2.0]'), '[OAuth 2.0](https://www.rfc-editor.org/rfc/rfc6749.html)');
  for (const src of ['`rfc:9110[]`', 'rfc:9110 alone', 'xrfc:9110[]', '```\nrfc:9110[]\n```']) {
    assert.equal(expand(src), src);
  }
});

test('an image alone in a paragraph is a captioned figure', () => {
  const { body } = render('![a cat](cat.jpg "Ginger, 2019")\n\n![a dog](dog.png)\n\nsee ![x](x.png) inline\n');
  assert.match(body, /<figure><img src="cat\.jpg" alt="a cat" title="Ginger, 2019"><figcaption>Ginger, 2019<\/figcaption><\/figure>/);
  assert.match(body, /<figure><img src="dog\.png" alt="a dog"><figcaption>a dog<\/figcaption><\/figure>/);
  assert.match(body, /<p>see <img src="x\.png" alt="x"> inline<\/p>/);
});

test('tables render', () => {
  const { body } = render('| a | b |\n|---|:-:|\n| 1 | 2 |\n');
  assert.match(body, /<table>\n<thead>\n<tr>\n<th>a<\/th>\n<th style="text-align:center">b<\/th>/);
});

