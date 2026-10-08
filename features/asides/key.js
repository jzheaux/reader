/**
 * Who an aside is from, and what it's about: a document's key of one-
 * character aliases, declared in its front matter, one per line,
 *
 *   -----
 *   reviewer #: Josh
 *   reviewer m: Maria, teal
 *   topic c: Coherence
 *   -----
 *
 * and used in a run straight after an aside's `~`, in any order:
 *
 *   ~#c This contradicts §2.        Josh, about Coherence
 *
 * A colour after the name (a CSS name or `#hex`) is the alias's own; the
 * rest are dealt from a palette in the order they're declared, reviewers
 * from its start and topics from its end, so the two don't look paired. A run counts when its aliases are
 * declared, all but one at most: that one is taken for a slip of the
 * finger and shown as not declared. So `~word` in a document without a
 * key, or prose that happens to start with a `~` (`~approximately`), is
 * left as it was.
 */

const ENTRY = /^\s*(reviewer|topic)\s+(\S)\s*:\s*(.+?)\s*$/i;
const COLOR = /^(?:#[0-9a-f]{3,8}|[a-z]+)$/i;

// Dark enough to read as text on the page and to hold apart in grey.
const PALETTE = ['#b5523b', '#2f7d6d', '#6a4fa3', '#9a6f0e', '#2f6aa1', '#a23d6d', '#4f7a2a', '#7a5c3e'];

/** A front matter line declaring an alias -> `{ kind, alias, name, color }`, or null. */
export function readEntry(line) {
  const m = ENTRY.exec(line);
  if (!m || m[2] === '~') return null;
  const [name, color] = m[3].split(/\s*,\s*/);
  if (!name) return null;
  return { kind: m[1].toLowerCase(), alias: m[2], name, color: color && COLOR.test(color) ? color : null };
}

/** Entries -> the key: each alias to its entry, with every colour filled in. */
export function makeKey(entries) {
  const key = new Map();
  const dealt = { reviewer: 0, topic: 0 };
  for (const e of entries) {
    if (key.has(e.alias)) continue;
    const k = dealt[e.kind]++ % PALETTE.length;
    key.set(e.alias, { ...e, color: e.color || PALETTE[e.kind === 'reviewer' ? k : PALETTE.length - 1 - k] });
  }
  return key;
}

/**
 * The run after an aside's `~` -> `{ who, topics, unknown }`: the first
 * reviewer named, the topics, and the alias not in the key, if one isn't;
 * or null when it isn't a run of aliases.
 */
export function attribute(run, key) {
  if (!run || !key?.size) return null;
  const chars = [...run];
  const declared = chars.filter((c) => key.has(c)).length;
  if (!declared || chars.length - declared > 1) return null;
  let who = null;
  const topics = [];
  const unknown = [];
  for (const c of chars) {
    const e = key.get(c);
    if (!e) unknown.push(c);
    else if (e.kind === 'reviewer') who ??= e;
    else if (!topics.includes(e)) topics.push(e);
  }
  return { who, topics, unknown };
}
