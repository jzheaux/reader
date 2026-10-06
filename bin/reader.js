#!/usr/bin/env node
/**
 *   reader <dir> [--port 8734] [--no-browser]
 *
 * Serve a directory of markdown for reading and editing in the browser.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from '../src/server.js';

const USAGE = `usage: reader <dir> [--port 8734] [--no-browser]

  <dir>          the content directory to serve (default: current directory)
  --port <n>     port to listen on (default: 8734, or the next free one)
  --no-browser   don't open a browser tab
  --open <file>  open this file first (path relative to <dir>)
`;

function parseArgs(argv) {
  const opts = { dir: null, port: null, browser: true, open: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      process.stdout.write(USAGE);
      process.exit(0);
    } else if (a === '--port' || a === '-p') {
      opts.port = Number(argv[++i]);
    } else if (a.startsWith('--port=')) {
      opts.port = Number(a.slice('--port='.length));
    } else if (a === '--no-browser') {
      opts.browser = false;
    } else if (a === '--open') {
      opts.open = argv[++i];
    } else if (a.startsWith('-')) {
      fail(`unknown option ${a}\n\n${USAGE}`);
    } else if (!opts.dir) {
      opts.dir = a;
    } else {
      fail(`unexpected argument ${a}\n\n${USAGE}`);
    }
  }
  if (opts.port !== null && (!Number.isInteger(opts.port) || opts.port < 0 || opts.port > 65535)) fail('--port must be a number');
  return opts;
}

function fail(msg) {
  process.stderr.write(`reader: ${msg}\n`);
  process.exit(1);
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* the URL is printed anyway */
  }
}

const opts = parseArgs(process.argv.slice(2));
const dir = path.resolve(opts.dir || '.');
if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) fail(`not a directory: ${dir}`);

const { server, content } = createServer({ root: dir });

// Without --port, count up from 8734 so each directory gets its own instance
// and the URLs stay about the same from run to run.
const DEFAULT_PORT = 8734;
const MAX_TRIES = 50;
let port = opts.port ?? DEFAULT_PORT;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && opts.port === null && port < DEFAULT_PORT + MAX_TRIES - 1) {
    server.listen(++port, '127.0.0.1');
    return;
  }
  if (err.code === 'EADDRINUSE') {
    fail(
      opts.port === null
        ? `ports ${DEFAULT_PORT}-${port} are all busy; pick one with --port.`
        : `port ${port} is busy; pick another with --port, or leave it off to use a free one.`
    );
  }
  fail(err.message);
});

server.listen(port, '127.0.0.1');

server.on('listening', () => {
  const { port } = server.address();
  const hash = opts.open ? `#${encodeURIComponent(opts.open)}` : '';
  const url = `http://127.0.0.1:${port}/${hash}`;
  const count = content.list().length;
  console.log(`\n  reader — ${content.root}`);
  console.log(`  ${count} file${count === 1 ? '' : 's'}`);
  console.log(`  ${url}\n  ctrl-c to stop\n`);
  if (opts.browser) openBrowser(url);
});

process.on('SIGINT', () => {
  console.log('\nstopped');
  process.exit(0);
});
