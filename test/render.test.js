import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, expand, math } from '../src/render.js';

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

test('a fence naming a puzzle is wrapped for the preview, numbered in order', () => {
  const { body, puzzles } = render('```sudoku\n5 3 .\n```\n\n```js\nx\n```\n\n```sudoku\n.\n```\n', { puzzleBase: 2 });
  assert.equal(puzzles, 2);
  assert.match(body, /<div class="puzzle" data-kind="sudoku" data-puzzle="2" data-from="1" data-to="2"><pre><code class="language-sudoku">5 3 \.\n<\/code><\/pre><\/div>/);
  assert.match(body, /data-puzzle="3" data-from="9" data-to="10"/);
  assert.match(body, /<pre><code class="language-js">x\n<\/code><\/pre>/);
  assert.doesNotMatch(body, /data-kind="js"/);
});

test('a tracks fence is a puzzle too', () => {
  const { body, puzzles } = render('```tracks\n1\n━  1\nA: left 1  B: right 1\n```\n');
  assert.equal(puzzles, 1);
  assert.match(body, /<div class="puzzle" data-kind="tracks" data-puzzle="0" /);
});

test('a wordsearch fence is a puzzle too', () => {
  const { body } = render('```wordsearch\nA B\nC D\nwords: AB\n```\n');
  assert.match(body, /<div class="puzzle" data-kind="wordsearch" data-puzzle="0" /);
});

test('a coord fence is a puzzle too', () => {
  const { body } = render('```coord\ngrid: 4 x 4\n(0, 0) (1, 1)\nplotted: 0\n```\n');
  assert.match(body, /<div class="puzzle" data-kind="coord" data-puzzle="0" /);
});

test('a puzzle can keep its board in a file next to the document', () => {
  const files = { 'gc/mazes/one.maze': '+--+\n|SE|\n+--+\n' };
  const read = (p) => {
    if (p in files) return files[p];
    throw new Error(`no such file: ${p}`);
  };
  const src = '```maze mazes/one.maze\npath: R\n```\n\n```maze\n+--+\n|SE|\n+--+\n```\n\n```maze gone.maze\n```\n';
  const { body } = render(src, { file: 'gc/packet.md', read });
  const hosts = body.match(/<div class="puzzle"[^>]*>/g);
  assert.equal(hosts.length, 3);
  assert.match(hosts[0], /data-source="\+--\+\n\|SE\|\n\+--\+"/);
  assert.doesNotMatch(hosts[1], /data-source/);
  assert.match(hosts[2], /data-source-error="gone\.maze: no such file: gc\/gone\.maze"/);
});

test('a puzzle knows the lines inside its fence, even unclosed', () => {
  const { body } = render('# Hi\n\n```sudoku\n1 2\n3 4\n```\n\n```maze\n```\n\n```coord\ngrid: 1 x 1\n', { line: 10 });
  const hosts = body.match(/<div class="puzzle"[^>]*>/g);
  assert.match(hosts[0], /data-from="13" data-to="15"/);
  assert.match(hosts[1], /data-from="18" data-to="18"/);
  assert.match(hosts[2], /data-from="21" data-to="22"/);
});
