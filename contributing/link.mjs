// Links each skill in contributing/ into the main checkout's .claude/skills/ (Claude Code)
// and .agents/skills/ (Codex and others), both git-ignored, so that an AI working on
// reader finds them. On Windows the links are directory junctions, which need no admin
// rights or Developer Mode. Run from a worktree, it links the main checkout to that
// worktree's skills, so the worktree's copies are the ones in use until it's run again
// from elsewhere.
// It also puts reader-review on the PATH, where npm puts what it installs globally
// (`npm prefix -g`, as `reader` is), or in --bin's folder, or READER_BIN's: a link to
// reader-review.mjs, or on Windows a reader-review.cmd that runs it.
//   node contributing/link.mjs [--force] [--unlink] [--bin <dir>]
// A folder or file already there that isn't one of these is left alone unless --force,
// which replaces it. --unlink removes what this made, and nothing else.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mainCheckout } from './lib/config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const force = process.argv.includes('--force');
const unlink = process.argv.includes('--unlink');
const main = mainCheckout(HERE);
const skills = fs.readdirSync(HERE).filter((d) => fs.existsSync(path.join(HERE, d, 'SKILL.md')));
const isLink = (p) => {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};
// A link of ours points into some checkout's contributing/<name>.
const ours = (p, name) => isLink(p) && path.basename(fs.readlinkSync(p).replace(/[\\/]+$/, '')) === name
  && path.basename(path.dirname(fs.readlinkSync(p).replace(/[\\/]+$/, ''))) === 'contributing';

let trouble = 0;
for (const into of ['.claude/skills', '.agents/skills']) {
  const dir = path.join(main, into);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of skills) {
    const at = path.join(dir, name);
    const to = path.join(HERE, name);
    const there = isLink(at) || fs.existsSync(at);
    if (unlink) {
      if (ours(at, name)) {
        fs.unlinkSync(at);
        console.log(`unlinked ${path.relative(main, at)}`);
      }
      continue;
    }
    if (there && !isLink(at) && !force) {
      console.log(`left    ${path.relative(main, at)}: a folder, not a link; --force replaces it`);
      trouble++;
      continue;
    }
    if (isLink(at)) fs.unlinkSync(at);
    else if (there) fs.rmSync(at, { recursive: true });
    fs.symlinkSync(to, at, process.platform === 'win32' ? 'junction' : 'dir');
    console.log(`linked  ${path.relative(main, at)} -> ${to}`);
  }
}

// reader-review, on the PATH.
const WIN = process.platform === 'win32';
const binAt = process.argv.indexOf('--bin');
function binDir() {
  if (binAt > 0 && process.argv[binAt + 1]) return path.resolve(process.argv[binAt + 1]);
  if (process.env.READER_BIN) return path.resolve(process.env.READER_BIN);
  try {
    const prefix = execFileSync('npm', ['prefix', '-g'], { encoding: 'utf8', shell: WIN, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (prefix) return WIN ? prefix : path.join(prefix, 'bin');
  } catch {
    // No npm: Node's own folder, which is on the PATH if node is.
  }
  return path.dirname(process.execPath);
}
const bin = binDir();
const script = path.join(HERE, 'reader-review.mjs');
const binLink = path.join(bin, WIN ? 'reader-review.cmd' : 'reader-review');
const shim = (to) => `@echo off\r\nnode "${to}" %*\r\n`;
// Ours: a link to some checkout's contributing/reader-review.mjs, or the .cmd that runs one.
const mine = () => {
  if (WIN) return fs.existsSync(binLink) && /contributing[\\/]reader-review\.mjs" %\*/.test(fs.readFileSync(binLink, 'utf8'));
  return isLink(binLink) && /(^|[\\/])contributing[\\/]reader-review\.mjs$/.test(fs.readlinkSync(binLink));
};
const there = isLink(binLink) || fs.existsSync(binLink);
if (unlink) {
  if (mine()) {
    fs.unlinkSync(binLink);
    console.log(`unlinked ${binLink}`);
  }
} else if (there && !mine() && !force) {
  console.log(`left    ${binLink}: not one of ours; --force replaces it`);
  trouble++;
} else {
  try {
    fs.mkdirSync(bin, { recursive: true });
    if (there) fs.rmSync(binLink, { force: true });
    if (WIN) fs.writeFileSync(binLink, shim(script));
    else fs.symlinkSync(script, binLink);
    console.log(`linked  ${binLink} -> ${script}`);
    const onPath = (process.env.PATH ?? '').split(path.delimiter).some((d) => d && path.resolve(d) === bin);
    if (!onPath) console.log(`        ${bin} isn't on the PATH; add it, or give --bin a folder that is`);
  } catch (e) {
    console.log(`left    ${binLink}: ${e.code ?? e.message}; give --bin a folder on the PATH you can write to`);
    trouble++;
  }
}
process.exit(trouble ? 1 : 0);
