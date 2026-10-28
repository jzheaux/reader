import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../src/server.js';

let server, base, root;

before(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-srv-'));
  fs.writeFileSync(path.join(root, 'note.md'), '# Note\n\n* a point\n\n~ my aside\n');
  fs.writeFileSync(path.join(root, 'page.html'), '<script>fetch("/api/tree")</script>');
  fs.writeFileSync(path.join(root, 'pic.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  fs.writeFileSync(path.join(root, 'doc.pdf'), '%PDF-1.4\n');
  ({ server } = createServer({ root }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const json = (method, url, body) =>
  fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('serves the UI and the tree', async () => {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /<textarea id="editor"/);
  const { files } = await (await fetch(base + '/api/tree')).json();
  assert.deepEqual(files.map((f) => f.path).sort(), ['doc.pdf', 'note.md']);
});

test("info says which reader this is, and where its notes are", async () => {
  const { version } = await (await fetch(base + '/api/info')).json();
  assert.match(version.label, /^v\d+\.\d+\.\d+(\+[0-9a-f]{7})?$/);
  assert.match(version.url, /^https:\/\/github\.com\/jzheaux\/reader\/(releases\/tag|commit)\//);
});

test('render puts asides in the gutter column', async () => {
  const res = await json('POST', '/api/render', { text: '* a point\n\n~ my aside\n', path: 'note.md' });
  const out = await res.json();
  assert.match(out.body, /gm-aside-cell/);
  assert.match(out.body, /my aside/);
  assert.match(out.body, /<h1 class="gm-title">note<\/h1>/);
  assert.match(out.css, /--gm-aside-col/);
  assert.equal(out.notes, 1);
  assert.equal(out.deck, false);
});

test('render says whether the text is a deck, for the Present button', async () => {
  const out = await (await json('POST', '/api/render', { text: '---\ntitle: x\n---\n\n# One\n\n---\n\n# Two\n' })).json();
  assert.equal(out.deck, true);
});

test('render gives a deck being worked through as pages, and a document as itself', async () => {
  const deck = await (await json('POST', '/api/render', { text: '# One\n\n---\n\n# [x] Two\n', path: 'talk.md', pages: true })).json();
  assert.equal(deck.deck, true);
  assert.deepEqual(deck.pages.map((p) => p.line), [0, 3]);
  assert.match(deck.pages[1].body, /<h1 class="task-heading"/);
  // A deck with no `title:` is titled with its file's name, as the editor is.
  assert.equal(deck.title, 'talk');
  const titled = await (await json('POST', '/api/render', { text: '---\ntitle: Talk\n---\n\n# One\n\n---\n\n# Two\n', path: 'talk.md', pages: true })).json();
  assert.equal(titled.title, 'Talk');
  const doc = await (await json('POST', '/api/render', { text: '# One\n', pages: true })).json();
  assert.equal(doc.pages, undefined);
  assert.match(doc.body, /One/);
});

test('a deck\'s pages come with its title, for the page\'s frame', async () => {
  const deck = await (await json('POST', '/api/render', { text: '---\ntitle: Talk\n---\n\n# One\n\n---\n\n# Two\n', pages: true })).json();
  assert.equal(deck.title, 'Talk');
});

test('slides splits a deck and lifts its notes', async () => {
  const res = await json('POST', '/api/slides', { text: '# One\n\n<!-- hi -->\n\n---\n\n# Two\n', path: 'deck.md' });
  const out = await res.json();
  assert.equal(out.slides.length, 2);
  assert.equal(out.slides[0].notes, 'hi');
  assert.match(out.slides[1].body, /Two/);
});

test('save round-trips and reports conflicts as 409', async () => {
  const f = await (await fetch(base + '/api/file?path=note.md')).json();
  let res = await json('PUT', '/api/file', { path: 'note.md', text: 'edited\n', baseMtime: f.mtime });
  assert.equal(res.status, 200);
  assert.equal(fs.readFileSync(path.join(root, 'note.md'), 'utf8'), 'edited\n');

  res = await json('PUT', '/api/file', { path: 'note.md', text: 'stale\n', baseMtime: f.mtime - 1000 });
  assert.equal(res.status, 409);
});

test('refuses escapes, non-JSON writes and foreign hosts', async () => {
  let res = await fetch(base + '/api/file?path=' + encodeURIComponent('../x.md'));
  assert.equal(res.status, 400);
  res = await fetch(base + '/content/..%2F..%2Fetc%2Fpasswd');
  assert.equal(res.status, 400);
  res = await fetch(base + '/api/file', { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(res.status, 415);

  const http = await import('node:http');
  const status = await new Promise((resolve) => {
    http.get(base + '/api/tree', { headers: { Host: 'evil.example:80' } }, (r) => resolve(r.statusCode));
  });
  assert.equal(status, 403);
});

test('a body over 20MB is answered with a 413, whether its length is given or not', async () => {
  const big = Buffer.alloc(21 * 1024 * 1024, 'a');
  const res = await fetch(base + '/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: big });
  assert.equal(res.status, 413);
  const status = await new Promise((resolve, reject) => {
    const req = http.request(base + '/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (r) => {
      r.resume();
      resolve(r.statusCode);
    });
    req.on('error', reject);
    for (let i = 0; i < 21; i++) req.write(big.subarray(0, 1024 * 1024));
    req.end();
  });
  assert.equal(status, 413);
});

test('a body, a field or an address that makes no sense is a 400, not a 500', async () => {
  const raw = (method, url, body) => fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body });
  for (const body of ['null', '[]', '"text"', '42']) {
    assert.equal((await raw('POST', '/api/render', body)).status, 400, body);
  }
  const bad = [
    ['POST', '/api/render', { text: 42 }],
    ['POST', '/api/render', { text: '# a', path: 42 }],
    ['POST', '/api/render', { text: '# a', pages: true, path: {} }],
    ['POST', '/api/slides', { text: ['# a'] }],
    ['PUT', '/api/file', { path: 'note.md', text: 'x', baseMtime: 'yesterday' }],
    ['POST', '/api/new', { name: 42 }],
    ['POST', '/api/rename', { moves: [null] }],
    ['POST', '/api/extract', { path: 'note.md', text: '', files: [null] }],
    ['POST', '/api/unextract', { path: 'note.md', text: '', mtime: 'then' }],
  ];
  for (const [method, url, body] of bad) {
    const res = await json(method, url, body);
    assert.equal(res.status, 400, `${url} ${JSON.stringify(body)}`);
    assert.equal(typeof (await res.json()).error, 'string');
  }
  for (const url of ['/content/%E0%A4%A', '/content/%', '/%E0%A4%A']) {
    assert.equal((await fetch(base + url)).status, 400, url);
  }
  const net = await import('node:net');
  for (const target of ['http://[', '//%zz', '/a%zz']) {
    const reply = await new Promise((resolve, reject) => {
      const socket = net.connect(server.address().port, '127.0.0.1');
      let got = '';
      socket.on('data', (c) => (got += c));
      socket.on('end', () => resolve(got));
      socket.on('error', reject);
      socket.end(`GET ${target} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
    });
    assert.match(reply, /^HTTP\/1\.1 400 /, target);
  }
});

test('exports a document as one HTML file, its images inside it', async () => {
  fs.writeFileSync(path.join(root, 'dot.png'), Buffer.from('iVBORw0KGgo=', 'base64'));
  fs.writeFileSync(path.join(root, 'out.md'), '---\ntitle: Out & about\nbackground: dot.png navy\n---\n\n![a dot](dot.png)\n\n![far](https://example.com/far.png)\n');
  const res = await fetch(`${base}/api/export?path=out.md`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(res.headers.get('content-disposition'), `attachment; filename="out.html"; filename*=UTF-8''out.html`);
  const html = await res.text();
  assert.match(html, /<title>Out &amp; about<\/title>/);
  assert.match(html, /<style>[\s\S]*--gm-aside-col/);
  assert.match(html, /<img src="data:image\/png;base64,iVBORw0KGgo="/);
  assert.match(html, /background-image: url\(&quot;data:image\/png;base64,iVBORw0KGgo=&quot;\)/);
  assert.match(html, /<img src="https:\/\/example\.com\/far\.png"/);
  assert.doesNotMatch(html, /data-line=/);

  fs.writeFileSync(path.join(root, 'chart.md'), '```mermaid\ngraph TD\n```\n');
  const drawn = await json('POST', '/api/export', { path: 'chart.md', drawn: { mermaid: { 'graph TD': '<svg id="m1"></svg>' } } });
  assert.equal(drawn.status, 200);
  assert.match(drawn.headers.get('content-disposition'), /filename="chart\.html"/);
  assert.match(await drawn.text(), /<div class="mermaid drawn"><pre>[\s\S]*<\/pre><div class="mermaid-figure" role="img" aria-label="Diagram"><svg id="m1"><\/svg><\/div><\/div>/);
  assert.doesNotMatch(await (await fetch(`${base}/api/export?path=chart.md`)).text(), /mermaid-figure"/);
  assert.equal((await json('POST', '/api/export', { path: 'doc.pdf' })).status, 400);

  assert.equal((await fetch(`${base}/api/export?path=doc.pdf`)).status, 400);
  assert.equal((await fetch(`${base}/api/export?path=gone.md`)).status, 404);
  assert.equal((await fetch(`${base}/api/export?path=${encodeURIComponent('../x.md')}`)).status, 400);
});

test('serves content files sandboxed, so their scripts never run as the app', async () => {
  for (const file of ['page.html', 'pic.svg', 'note.md']) {
    const res = await fetch(`${base}/content/${file}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-security-policy'), 'sandbox', file);
  }
  const pdf = await fetch(`${base}/content/doc.pdf`);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-security-policy'), null);
});

test('a script in the content directory is served as text, for this origin only', async () => {
  fs.writeFileSync(path.join(root, 'config.js'), 'window.token = "secret";\n');
  const res = await fetch(`${base}/content/config.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/plain/);
  assert.equal(res.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(await res.text(), 'window.token = "secret";\n');
  for (const url of ['/api/tree', '/content/page.html', '/content/doc.pdf']) {
    assert.equal((await fetch(base + url)).headers.get('cross-origin-resource-policy'), 'same-origin', url);
  }
  // What the sandboxed preview loads, which the browser counts as another origin's.
  fs.writeFileSync(path.join(root, 'dot.png'), Buffer.from('iVBORw0KGgo=', 'base64'));
  for (const url of ['/preview.js', '/features/qa/preview.js', '/content/dot.png']) {
    assert.equal((await fetch(base + url)).headers.get('cross-origin-resource-policy'), null, url);
  }
});

test("another site's page can't ask for the API or the user's files, but a link from it opens them", async () => {
  fs.writeFileSync(path.join(root, 'config.js'), 'window.token = "secret";\n');
  fs.writeFileSync(path.join(root, 'dot.png'), Buffer.from('iVBORw0KGgo=', 'base64'));
  // Not by fetch(), which sets Sec-Fetch-Mode itself.
  const ask = (url, headers, method = 'GET') => new Promise((resolve, reject) => {
    http.request(base + url, { method, headers }, (res) => {
      res.resume();
      resolve(res.statusCode);
    }).on('error', reject).end(method === 'POST' ? '{}' : undefined);
  });
  const from = (site, mode, dest) => ({ 'Sec-Fetch-Site': site, 'Sec-Fetch-Mode': mode, 'Sec-Fetch-Dest': dest });
  for (const site of ['cross-site', 'same-site']) {
    assert.equal(await ask('/content/config.js', from(site, 'no-cors', 'script')), 403, site);
    assert.equal(await ask('/content/note.md', from(site, 'no-cors', 'style')), 403, site);
    assert.equal(await ask('/api/tree', from(site, 'cors', 'empty')), 403, site);
    assert.equal(await ask('/api/file?path=note.md', from(site, 'no-cors', 'script')), 403, site);
    assert.equal(await ask('/content/doc.pdf', from(site, 'navigate', 'iframe')), 403, site);
    assert.equal(await ask('/api/render', { ...from(site, 'cors', 'empty'), 'Content-Type': 'application/json' }, 'POST'), 403, site);
    // A link followed from elsewhere, to the app, a line, or a file.
    assert.equal(await ask('/', from(site, 'navigate', 'document')), 200, site);
    assert.equal(await ask('/content/doc.pdf', from(site, 'navigate', 'document')), 200, site);
    assert.equal(await ask('/content/doc.pdf', from(site, 'navigate', 'document'), 'HEAD'), 200, site);
  }
  // The sandboxed preview has no origin, so its scripts, styles and a note's images come cross-site.
  for (const [url, dest] of [['/preview.js', 'script'], ['/preview.css', 'style'], ['/features/qa/preview.js', 'script'], ['/content/dot.png', 'image']]) {
    assert.equal(await ask(url, from('cross-site', 'no-cors', dest)), 200, url);
  }
  // The app itself, a page typed in, and a client that doesn't say.
  assert.equal(await ask('/content/config.js', from('same-origin', 'no-cors', 'script')), 200);
  assert.equal(await ask('/api/tree', from('same-origin', 'cors', 'empty')), 200);
  assert.equal(await ask('/content/config.js', from('none', 'navigate', 'document')), 200);
  assert.equal(await ask('/api/tree', {}), 200);
});

test('the preview loads a script for each kind of puzzle and each feature that has one', async () => {
  const html = await (await fetch(base + '/preview.html')).text();
  assert.match(html, /<script src="\/features\/puzzles\/preview\.js"><\/script>/);
  for (const kind of ['sudoku', 'tracks', 'wordsearch', 'coord', 'maze']) {
    assert.match(html, new RegExp(`<script src="/features/puzzles/kinds/${kind}\\.js"></script>`));
    assert.equal((await fetch(`${base}/features/puzzles/kinds/${kind}.js`)).status, 200);
  }
  // The core comes before the kinds that register with it.
  assert.ok(html.indexOf('/features/puzzles/preview.js') < html.indexOf('/features/puzzles/kinds/'));
  for (const name of ['fields', 'tasks', 'qa']) {
    assert.match(html, new RegExp(`<script src="/features/${name}/preview\\.js"></script>`));
    const res = await fetch(`${base}/features/${name}/preview.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /javascript/);
  }
  assert.doesNotMatch(html, /<!-- scripts -->/);
  // Only the scripts features name are served from there.
  for (const other of ['/features/fields/index.js', '/features/qa/index.js', '/features/index.js', '/features/puzzles/index.js', '/puzzles/sudoku.js']) {
    assert.equal((await fetch(base + other)).status, 404, other);
  }
});

test('each page says what it may load: its own scripts only, nothing inline', async () => {
  const policy = async (url) => (await fetch(base + url)).headers.get('content-security-policy');
  for (const page of ['/', '/speaker.html', '/preview.html']) {
    const csp = await policy(page);
    assert.match(csp, /default-src 'none'/, page);
    assert.match(csp, /script-src 'self'(;|$)/, page);
    assert.match(csp, /object-src 'none'/, page);
  }
  assert.match(await policy('/'), /frame-ancestors 'none'/);
  assert.match(await policy('/'), /style-src 'self'(;|$)/);
  assert.match(await policy('/preview.html'), /frame-ancestors 'self'/);
  assert.match(await policy('/preview.html'), /style-src 'self' 'unsafe-inline'/);
  const print = await policy('/print.html');
  assert.match(print, /default-src 'none'/);
  assert.doesNotMatch(print, /script-src/);
  assert.match(print, /style-src 'unsafe-inline'/);
  for (const page of ['index.html', 'speaker.html', 'preview.html', 'print.html']) {
    const html = await (await fetch(`${base}/${page}`)).text();
    assert.doesNotMatch(html, /<script>|<script(?![^>]*\bsrc=)[^>]*>|\son[a-z]+=/i, `${page} has no inline script`);
  }
});

test('a page is served only by its own name, so no spelling of it comes without its policy', async () => {
  for (const url of ['/PREVIEW.HTML', '/Preview.html', '/INDEX.HTML', '/Speaker.html', '/APP/main.js']) {
    const res = await fetch(base + url);
    assert.equal(res.status, 404, url);
  }
  assert.equal((await fetch(base + '/preview.html')).status, 200);
});

test('a request addressed to another host is refused, unless the server was started with its name', async () => {
  const ask = (port, host) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: '/api/info', headers: { Host: host } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    }).on('error', reject);
  });
  assert.equal(await ask(server.address().port, 'my-nas:8734'), 403);
  const named = createServer({ root, allowHosts: ['My-NAS'] }).server;
  await new Promise((r) => named.listen(0, '127.0.0.1', r));
  try {
    assert.equal(await ask(named.address().port, 'my-nas:8734'), 200);
    assert.equal(await ask(named.address().port, 'localhost'), 200);
    assert.equal(await ask(named.address().port, 'evil.example'), 403);
  } finally {
    named.close();
  }
});
