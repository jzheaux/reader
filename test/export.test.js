import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { findBrowser, openBrowser } from '../src/browser.js';

const READER = path.join(import.meta.dirname, '..', 'bin', 'reader.js');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

function dir(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-export-'));
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), body);
  }
  return root;
}

const reader = (cwd, ...args) => promisify(execFile)(process.execPath, [READER, 'export', ...args], { cwd });

test('export saves each document beside itself, its images inside it', async () => {
  const root = dir({ 'a.md': '# A\n\n![](pic.png)\n', 'deck/b.md': '# B\n', 'pic.png': PNG });
  const { stdout, stderr } = await reader(root, 'a.md', 'deck/b.md', '--no-draw');
  assert.match(stdout, /a\.md -> a\.html/);
  assert.match(stdout, /deck\/b\.md -> deck\/b\.html/);
  assert.equal(stderr, '');
  assert.match(fs.readFileSync(path.join(root, 'a.html'), 'utf8'), /src="data:image\/png;base64,/);
  assert.match(fs.readFileSync(path.join(root, 'deck', 'b.html'), 'utf8'), /<title>b<\/title>/);
});

test('a link to a document saved with this one goes to its page, and others stay', async () => {
  const root = dir({
    'a.md': '[b](deck/b.md) [part](deck/b.md#x) [c](c.md) [web](https://example.com/d.md)\n',
    'deck/b.md': '[back](../a.md)\n',
    'c.md': '# C\n',
  });
  await reader(root, 'a.md', 'deck/b.md', '--no-draw');
  const a = fs.readFileSync(path.join(root, 'a.html'), 'utf8');
  assert.match(a, /href="deck\/b\.html">b</);
  assert.match(a, /href="deck\/b\.html#x">part</);
  assert.match(a, /href="c\.md">c</);
  assert.match(a, /href="https:\/\/example\.com\/d\.md">web</);
  assert.match(fs.readFileSync(path.join(root, 'deck', 'b.html'), 'utf8'), /href="\.\.\/a\.html">back</);
});

test('export says which images it could not find', async () => {
  const root = dir({ 'a.md': '![](gone.png)\n![](https://example.com/x.png)\n' });
  const { stderr } = await reader(root, 'a.md', '--out', 'elsewhere.html', '--no-draw');
  assert.match(stderr, /a\.md: no gone\.png, so it's left as a link/);
  assert.doesNotMatch(stderr, /example\.com/);
  assert.match(fs.readFileSync(path.join(root, 'elsewhere.html'), 'utf8'), /src="gone\.png"/);
  assert.ok(!fs.existsSync(path.join(root, 'a.html')));
});

test('export refuses what it cannot save', async () => {
  const root = dir({ 'a.md': '', 'b.md': '', 'doc.pdf': '' });
  await assert.rejects(reader(root, 'gone.md'), /no such file: gone\.md/);
  await assert.rejects(reader(root, 'doc.pdf'), /not a document/);
  await assert.rejects(reader(root, '../x.md'), /isn't under/);
  await assert.rejects(reader(root, 'a.md', 'b.md', '--out', 'x.html'), /--out is for one document/);
  await assert.rejects(reader(root), /which document/);
});

test('export replaces a link where its page goes, and leaves what it pointed at alone', async () => {
  const root = dir({ 'repo/deck.md': '# Deck\n', 'victim/important.txt': 'keep me' });
  fs.symlinkSync(path.join('..', 'victim', 'important.txt'), path.join(root, 'repo', 'deck.html'));
  await reader(path.join(root, 'repo'), 'deck.md', '--no-draw');
  assert.equal(fs.readFileSync(path.join(root, 'victim', 'important.txt'), 'utf8'), 'keep me');
  assert.ok(fs.lstatSync(path.join(root, 'repo', 'deck.html')).isFile());
  assert.match(fs.readFileSync(path.join(root, 'repo', 'deck.html'), 'utf8'), /<title>deck<\/title>/);
  assert.deepEqual(fs.readdirSync(path.join(root, 'repo')).sort(), ['deck.html', 'deck.md']);
});

test('a deck is saved as its pages, without its notes, each a numbered sheet on paper', async () => {
  const root = dir({ 'deck.md': '---\ntitle: Packet\nbackground: navy\n---\n\n# One\n\n<!-- a note -->\n\ntext\n*Page 1*\n---\n\n# Two\n\n<!-- background: none -->\n' });
  await reader(root, 'deck.md', '--no-draw');
  const html = fs.readFileSync(path.join(root, 'deck.html'), 'utf8');
  assert.match(html, /<title>Packet<\/title>/);
  const pages = [...html.matchAll(/<div class="gm-page">\n([\s\S]*?)\n<\/div>\n(?=<div class="gm-page">|<script|<\/body>)/g)].map((m) => m[1]);
  assert.equal(pages.length, 2);
  // The --- under a line of text ends the page; it doesn't underline it.
  assert.match(pages[0], /^<div class="gm-bg" style="background-color: navy"><\/div>\n<div class="gm-doc">[\s\S]*<h1>One<\/h1>\n<p>text\n<em>Page 1<\/em><\/p>/);
  assert.match(pages[1], /^<div class="gm-doc">[\s\S]*<h1>Two<\/h1>/);
  assert.doesNotMatch(html.slice(html.indexOf('<body>')), /a note|gm-masthead|data-line/);
  assert.match(html, /@media print \{\n {2}\.gm-page \{ page: numbered; \}\n {2}\.gm-page \+ \.gm-page \{ border-top: none; break-before: page; \}/);
  // A dark deck prints in the light colours, and the bounds that keep an
  // author's own colour readable print with them (#172).
  assert.match(html, /:root\.gm-dark \{ [^}]*--gm-key-l-min: 0;[^}]*--gm-key-l-max: 0\.5;[^}]*--gm-key-c-max: 0\.4;/);
  assert.match(html, /@page numbered \{\n {2}@bottom-center \{\n {4}content: counter\(page\);/);
});

test('a deck with speaker notes prints across the sheet, one without down it, unless print: says', async () => {
  const root = dir({
    'talk.md': '# One\n\n<!-- say this -->\n\n---\n\n# Two\n',
    'packet.md': '# One\n\n---\n\n# Two\n',
    'turned.md': '---\nprint: Landscape\n---\n\n# One\n\n---\n\n# Two\n',
  });
  await reader(root, 'talk.md', 'packet.md', 'turned.md', '--no-draw');
  const size = (name) => /@page numbered \{ size: (\w+); \}/.exec(fs.readFileSync(path.join(root, name), 'utf8'))?.[1];
  assert.equal(size('talk.html'), 'landscape');
  assert.equal(size('packet.html'), 'portrait');
  assert.equal(size('turned.html'), 'landscape');
});

test('an exported page runs only its own script', async () => {
  const root = dir({ 'deck.md': '---\nbackground: navy\n---\n\n# One\n' });
  await reader(root, 'deck.md', '--no-draw');
  const html = fs.readFileSync(path.join(root, 'deck.html'), 'utf8');
  const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/)?.[1];
  assert.ok(policy, 'no policy');
  assert.match(policy, /default-src 'none'/);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(scripts.length, 1);
  // The preview frame's own inking, by contrast (static/ink.js).
  assert.equal(scripts[0], `${fs.readFileSync(path.join(import.meta.dirname, '..', 'static', 'ink.js'), 'utf8')}Ink.set();\n`);
  const hash = crypto.createHash('sha256').update(scripts[0]).digest('base64');
  assert.match(policy, new RegExp(`script-src 'sha256-${hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
});

test('a document that is not a deck is saved whole', async () => {
  const root = dir({ 'a.md': '# A\n\ntext\n' });
  await reader(root, 'a.md', '--no-draw');
  const html = fs.readFileSync(path.join(root, 'a.html'), 'utf8');
  assert.match(html, /<header class="gm-masthead">/);
  assert.doesNotMatch(html, /gm-page/);
});

test('a browser that can\'t start is an error, not a wait', { timeout: 10000 }, async () => {
  await assert.rejects(openBrowser(path.join(os.tmpdir(), 'no-such-browser'), 'http://127.0.0.1:1/'), /ENOENT/);
});

test('export draws diagrams with a browser', { skip: !findBrowser() && 'no Chrome or Chromium here', timeout: 60000 }, async () => {
  const root = dir({ 'a.md': '```mermaid\nflowchart LR\n  draft --> publish\n```\n' });
  await reader(root, 'a.md');
  const html = fs.readFileSync(path.join(root, 'a.html'), 'utf8');
  assert.match(html, /<div class="mermaid-figure" role="img" aria-label="Diagram"><svg/);
  assert.match(html, /draft/);
});
