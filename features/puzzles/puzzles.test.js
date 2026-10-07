import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';

// A puzzle's opening tag; its attributes' values can hold a `>`.
const HOST = /<div class="puzzle"(?:[^>"]|"[^"]*")*>/g;

test('a fence naming a puzzle is wrapped for the preview, numbered in order', () => {
  const shared = { puzzles: 2 };
  const { body } = render('```sudoku\n5 3 .\n```\n\n```js\nx\n```\n\n```sudoku\n.\n```\n', { shared });
  assert.equal(shared.puzzles, 4);
  assert.match(body, /<div class="puzzle" data-kind="sudoku" data-puzzle="2" data-from="1" data-to="2"><pre><code class="language-sudoku">5 3 \.\n<\/code><\/pre><\/div>/);
  assert.match(body, /data-puzzle="3" data-from="9" data-to="10"/);
  assert.match(body, /<pre><code class="language-js">x\n<\/code><\/pre>/);
  assert.doesNotMatch(body, /data-kind="js"/);
});

test('a tracks fence is a puzzle too', () => {
  const { body } = render('```tracks\n1\n━  1\nA: left 1  B: right 1\n```\n');
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
  const hosts = body.match(HOST);
  assert.equal(hosts.length, 3);
  assert.match(hosts[0], /data-source="\+--\+\n\|SE\|\n\+--\+"/);
  assert.doesNotMatch(hosts[1], /data-source/);
  assert.match(hosts[2], /data-source-error="gone\.maze: no such file: gc\/gone\.maze"/);
});

test('a puzzle knows the lines inside its fence, even unclosed', () => {
  const { body } = render('# Hi\n\n```sudoku\n1 2\n3 4\n```\n\n```maze\n```\n\n```coord\ngrid: 1 x 1\n', { line: 10 });
  const hosts = body.match(HOST);
  assert.match(hosts[0], /data-from="13" data-to="15"/);
  assert.match(hosts[1], /data-from="18" data-to="18"/);
  assert.match(hosts[2], /data-from="21" data-to="22"/);
});

test('a puzzle in a quote or a list knows its lines, and what they start with', () => {
  const src = '> ```sudoku\n> 5 3 .\n> ```\n\n- item\n\n  ```maze\n  path: R\n  ```\n\n> ```coord\n> ```\n';
  const hosts = render(src).body.match(HOST);
  assert.equal(hosts.length, 3);
  assert.match(hosts[0], /data-kind="sudoku" data-puzzle="0" data-from="1" data-to="2" data-prefix="> "/);
  assert.match(hosts[1], /data-kind="maze" data-puzzle="1" data-from="7" data-to="8" data-prefix=" {2}"/);
  assert.match(hosts[2], /data-kind="coord" data-puzzle="2" data-from="11" data-to="11" data-prefix="> "/);
});

test('a puzzle whose lines start differently, or in an aside, can be seen but not played', () => {
  // A blank line written as a bare `>` doesn't start the way the others do.
  const { body } = render('> ```sudoku\n> 5 3 .\n>\n> 2 4 6\n> ```\n\ntext\n\n~ ```sudoku\n~ 1\n~ ```\n');
  const hosts = body.match(HOST);
  assert.ok(hosts.length >= 1);
  for (const h of hosts) assert.doesNotMatch(h, /data-from/);
});

test('a board file is paired with its own fence, wherever the fences are', () => {
  const src = '> ```sudoku\n> 5 3 .\n> ```\n\n```maze mazes/one.maze\npath: R\n```\n';
  const read = () => '+--+\n|SE|\n+--+';
  const hosts = render(src, { file: 'doc.md', read }).body.match(HOST);
  assert.doesNotMatch(hosts[0], /data-source/);
  assert.match(hosts[0], /data-from="1"/);
  assert.match(hosts[1], /data-kind="maze" data-puzzle="1" data-from="5" data-to="6" data-source=/);
});
