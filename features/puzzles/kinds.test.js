import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { KINDS } from './index.js';

/**
 * Each kind of puzzle, loaded as the preview loads it but without a page:
 * what it registers is its text and its rules, which don't need one.
 */
function load(kind) {
  const registered = {};
  const Puzzles = { register: (name, impl) => { registered[name] = impl; }, owns: () => true, frame: () => ({}) };
  vm.runInNewContext(fs.readFileSync(new URL(`./kinds/${kind}.js`, import.meta.url), 'utf8'), { Puzzles });
  return registered[kind];
}

const sudoku = load('sudoku');
const tracks = load('tracks');
const wordsearch = load('wordsearch');
const coord = load('coord');
const maze = load('maze');

// Made in the puzzle's own context, so compared as plain values.
const plain = (x) => JSON.parse(JSON.stringify(x));

/** Its text, read and written back, reads the same again. */
function roundTrips(kind, text) {
  const s = kind.parse(text);
  assert.ok(s, `can't read:\n${text}`);
  const again = kind.format(s);
  assert.equal(kind.format(kind.parse(again)), again, 'writing it is stable');
  return again;
}

test('every kind in kinds/ registers its text, rules and drawing', () => {
  assert.deepEqual(KINDS, ['coord', 'maze', 'sudoku', 'tracks', 'wordsearch']);
  for (const kind of KINDS) {
    const k = load(kind);
    for (const fn of ['parse', 'format', 'solved', 'mount']) assert.equal(typeof k[fn], 'function', `${kind}.${fn}`);
  }
});

const SUDOKU = `
5 3 . | . 7 . | . . .
6 . . | 1 9 5 | . . .
. 9 8 | . . . | . 6 .
------+-------+------
8 . . | . 6 . | . . 3
4 . . | 8 . 3 | . . 1
7 . . | . 2 . | . . 6
------+-------+------
. 6 . | . . . | 2 8 .
. . . | 4 1 9 | . . 5
. . . | . 8 . | . 7 9`.trim();

const SOLUTION = [
  '534678912', '672195348', '198342567', '859761423', '426853791', '713924856', '961537284', '287419635', '345286179',
].join('').split('').map(Number);

test('sudoku: a fresh puzzle is its own board, written beside it once played', () => {
  const s = sudoku.parse(SUDOKU);
  assert.deepEqual(plain(s.board), plain(s.givens));
  s.board[2] = 4;
  s.notes.set(3, new Set([2, 6]));
  const text = sudoku.format(s);
  assert.match(text.split('\n')[0], /^5 3 \. \| \. 7 \. \| \. \. \. {4}5 3 4 \| \. 7 \. \| \. \. \.$/);
  assert.match(text, /\nnotes: r1c4=26$/);
  assert.equal(roundTrips(sudoku, text), text);
});

test('sudoku: givens hold, notes on a filled square go, and repeats are found', () => {
  const s = sudoku.parse(`${SUDOKU}\nnotes: r1c1=12 r1c3=4`);
  assert.equal(s.notes.has(0), false, 'r1c1 is a given');
  assert.deepEqual(plain([...s.notes.get(2)]), [4]);
  s.board[2] = 5;
  assert.deepEqual(plain([...sudoku.rules.conflicts(s.board)].sort((a, b) => a - b)), [0, 2]);
  assert.equal(sudoku.solved(s), false);
});

test('sudoku: a full board with nothing repeated is solved', () => {
  const s = sudoku.parse(SUDOKU);
  s.board = [...SOLUTION];
  assert.equal(sudoku.solved(s), true);
  s.board[80] = 0;
  assert.equal(sudoku.solved(s), false);
  assert.equal(sudoku.parse('5 3 .\n6 . .'), null);
});

const TRACKS = `
1 1 3
━ · ·  3
· · ·  1
· · ·  1
A: left 1  B: bottom 3`.trim();

test('tracks: laid track is written in light pieces, and reads back', () => {
  const s = tracks.parse(TRACKS);
  const [E, S, W] = [2, 4, 8];
  assert.equal(tracks.rules.layTrack(s, 0, E), 'added');
  assert.equal(tracks.rules.layTrack(s, 1, E), 'added');
  assert.equal(tracks.rules.layTrack(s, 2, S), 'added');
  assert.equal(tracks.rules.layTrack(s, 5, S), 'added');
  const text = tracks.format(s);
  assert.equal(text.split('\n')[1], '━ ─ ┐  3');
  assert.equal(text.split('\n')[2], '· · │  1');
  assert.equal(text.split('\n')[3], '· · ╵  1');
  assert.equal(roundTrips(tracks, text), text);
  assert.equal(tracks.solved(s), false, 'not out at B yet');
  assert.equal(tracks.rules.layTrack(s, 8, S), 'added', 'out through B');
  assert.equal(tracks.solved(s), true);
  assert.equal(tracks.rules.layTrack(s, 8, W), 'blocked', 'a square takes two ways at most');
  assert.equal(tracks.rules.layTrack(s, 0, W), 'blocked', 'given track stays');
});

test('tracks: laying again picks it up, clearing a square clears its neighbors\' half, and counts follow', () => {
  const s = tracks.parse(TRACKS);
  const [E, S] = [2, 4];
  tracks.rules.layTrack(s, 1, E);
  assert.equal(tracks.rules.layTrack(s, 1, E), 'removed');
  tracks.rules.layTrack(s, 1, E);
  tracks.rules.layTrack(s, 2, S);
  tracks.rules.clearSquare(s, 2);
  assert.equal(s.mine[2], 0);
  assert.equal(s.mine[1], 0, 'its half toward 2 went too');
  assert.equal(s.mine[5], 0);
  assert.deepEqual(plain(tracks.rules.tally(s)), { rows: [1, 0, 0], cols: [1, 0, 0], total: 1 });
  assert.equal(tracks.parse(TRACKS.replace('A: left 1', 'A: left 9')), null, 'an end off the grid');
});

const WORDSEARCH = `
B E L I E V E
H O N E S T Q
A B L E X Y Z
words: ABLE, BELIEVE, HONEST, ZEST`.trim();

test('wordsearch: a listed word circled is found, either way it reads', () => {
  const s = wordsearch.parse(WORDSEARCH);
  assert.equal(wordsearch.rules.circle(s, [0, 0], [0, 6]).result, 'found');
  assert.equal(wordsearch.rules.circle(s, [1, 5], [1, 0]).result, 'found', 'TSENOH backwards');
  assert.equal(wordsearch.rules.circle(s, [0, 0], [0, 6]).result, 'already');
  const text = wordsearch.format(s);
  assert.match(text, /\nfound: BELIEVE r1c1-r1c7, HONEST r2c1-r2c6$/);
  assert.equal(roundTrips(wordsearch, text), text);
  assert.equal(wordsearch.solved(s), false);
});

test('wordsearch: anything else circled is a gray mark, and circling it again erases it', () => {
  const s = wordsearch.parse(WORDSEARCH);
  assert.deepEqual(plain(wordsearch.rules.circle(s, [1, 2], [1, 5])), { result: 'marked', letters: 'NEST' });
  assert.match(wordsearch.format(s), /\nmarks: NEST r2c3-r2c6$/);
  assert.equal(wordsearch.rules.circle(s, [1, 5], [1, 2]).result, 'erased');
  assert.equal(s.marks.length, 0);
  // A mark inside a word found later becomes part of it.
  wordsearch.rules.circle(s, [1, 2], [1, 5]);
  wordsearch.rules.circle(s, [1, 0], [1, 5]);
  assert.equal(s.marks.length, 0);
  assert.equal(wordsearch.rules.circle(s, [0, 0], [1, 2]).result, 'crooked');
  assert.equal(wordsearch.rules.circle(s, [0, 0], [0, 0]).result, 'single');
});

test('wordsearch: a recorded find that isn\'t really there is dropped', () => {
  const s = wordsearch.parse(`${WORDSEARCH}\nfound: ABLE r3c1-r3c4, ZEST r1c1-r1c4\nmarks: XYZ r3c5-r3c7`);
  assert.deepEqual(plain(s.found.map((f) => f.word)), ['ABLE']);
  assert.equal(s.marks.length, 1);
});

const COORD = `
grid: 10 x 8
(1, 1) (5, 1) (5, 4)
(7, 2) (9, 2)
plotted: 3`.trim();

test('coord: points are counted through the strokes, and the picture completes', () => {
  const s = coord.parse(COORD);
  assert.equal(s.total, 5);
  assert.deepEqual(plain(coord.rules.nth(s, 3)), { stroke: 1, at: 0, point: [7, 2] });
  assert.equal(coord.solved(s), false);
  s.plotted = 5;
  assert.equal(coord.solved(s), true);
  assert.equal(roundTrips(coord, coord.format(s)), coord.format(s));
  assert.equal(coord.parse(COORD.replace('plotted: 3', 'plotted: 99')).plotted, 5, 'no more than there are');
  assert.equal(coord.parse(COORD.replace('(9, 2)', '(19, 2)')), null, 'off the grid');
});

// S goes right, down, left, down, along the bottom and up into E.
const MAZE = `
+--+--+--+
|S    |  |
+--+  +  +
|     | E|
+  +--+  +
|        |
+--+--+--+`.trim();

test('maze: a path is walked from S, stopping at a wall; a step back takes a step off', () => {
  assert.deepEqual(plain(maze.parse(`${MAZE}\npath: R D L R`).path), [[0, 0], [0, 1], [1, 1]]);
  assert.deepEqual(plain(maze.parse(`${MAZE}\npath: R R D`).path), [[0, 0], [0, 1]]);
  assert.deepEqual(plain(maze.parse(`${MAZE}\npath: D2`).path), [[0, 0]], 'a wall below S');
  const text = maze.format(maze.parse(`${MAZE}\npath: R\nnotes: r2c1 r2c1 r9c9`));
  assert.match(text, /\npath: R\nnotes: r2c1$/);
  assert.equal(roundTrips(maze, text), text);
});

test('maze: the way from S to E is found, and walking it solves the maze', () => {
  const m = maze.parse(MAZE);
  assert.equal(maze.solved(m), false);
  const way = maze.rules.route(m, m.start, m.end);
  assert.equal(way, 'RDLDRRU');
  const done = maze.parse(`${MAZE}\npath: ${[...way].join(' ')}`);
  assert.equal(maze.solved(done), true);
  assert.match(maze.format(done), /\npath: R D L D R2 U\n/);
});

test('maze: the two-characters-to-a-cell drawing reads too', () => {
  const m = maze.parse(' _______\n|S  |  _|\n|_|___ E|');
  assert.ok(m);
  assert.deepEqual(plain(m.start), [0, 0]);
});
