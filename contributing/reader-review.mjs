#!/usr/bin/env node
// reader, as the batch under review has it: `reader-review <dir>` from anywhere, as `reader <dir>`.
// It runs the newest review/YYYY.MM.DD worktree's `npm run dev` (scripts/dev.js), so the page
// shows each change the batch makes, from the folder it's run in, so a relative <dir> is
// the one meant. With no review worktree, it's main's. reader takes the next free port
// after 8734, so this and the installed reader run side by side.
//   reader-review <dir> [reader's options]
//   reader-review --at <branch> <dir> ...   a branch checked out in some worktree, such as main
//   reader-review --which [--at <branch>]   says which checkout it would run, and stops
// node contributing/link.mjs puts it on the PATH.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mainCheckout } from './lib/config.mjs';
import { worktrees } from './lib/git.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fail = (m, code = 1) => {
  console.error(`reader-review: ${m}`);
  process.exit(code);
};
const tilde = (p) => (p.startsWith(os.homedir() + path.sep) ? `~${p.slice(os.homedir().length)}` : p);

// Its own options, taken out; the rest are reader's.
const args = process.argv.slice(2);
let at = null;
let which = false;
for (let i = 0; i < args.length;) {
  if (args[i] === '--at') {
    at = args[i + 1];
    if (!at) fail('--at needs a branch, such as main or review/2026.11.23', 2);
    args.splice(i, 2);
  } else if (args[i].startsWith('--at=')) {
    at = args[i].slice(5);
    args.splice(i, 1);
  } else if (args[i] === '--which') {
    which = true;
    args.splice(i, 1);
  } else i++;
}

const main = mainCheckout(HERE);
const all = worktrees(main);
let branch;
if (at) {
  branch = at;
  if (!all[branch]) fail(`${branch} isn't checked out in any worktree; these are: ${Object.keys(all).sort().join(', ')}`);
} else {
  // review/YYYY.MM.DD sorts by date, so the last is the newest.
  branch = Object.keys(all).filter((b) => /^review\/\d{4}\.\d{2}\.\d{2}$/.test(b)).sort().at(-1)
    ?? Object.keys(all).find((b) => all[b] === main) ?? 'main';
}
const checkout = all[branch] ?? main;

console.error(`reader-review: ${branch}, in ${tilde(checkout)}`);
if (which) process.exit(0);
if (!fs.existsSync(path.join(checkout, 'node_modules'))) fail(`no node_modules there yet: npm --prefix ${tilde(checkout)} install`);

const child = spawn(process.execPath, [path.join(checkout, 'scripts', 'dev.js'), ...args], { stdio: 'inherit' });
// A ^C reaches both; this waits for dev.js to stop reader, then goes too.
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
