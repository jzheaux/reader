/**
 * `- [ ]` and `- [x]` at the head of a list item are a checkbox; `- ( )` and
 * `- (x)` a radio button, one choice to a list. They work wherever a list
 * does: in a quote, in an aside. `# [ ]` at the head of a heading is a
 * checkbox too, for the section under it, or the page of a workbook, being
 * done; there's no radio button there.
 *
 * Boxes in a row, `- [x][ ][ ]`, are one box with stages: each click fills
 * the next, and once they're all filled the item is done. The front matter
 * names the stages, for every staged box in the document:
 *
 *   multibox:
 *     stages: have, prepped, used
 *
 *   - [x][x][ ] 1 small yellow onion, diced
 *
 * `reset:[]` is a button that clears every box in its section -- the
 * heading it's under, to the next at that level or above -- as one edit:
 * `reset:[Start over]` names it. When the section has a heading `Log` in
 * it, a second button adds a heading for today to the end of the log,
 * with the multiple the section's multiplier is at (features/count).
 *
 * Each box carries its line, and that line as it reads checked and
 * unchecked (a staged box, at each stage), so the preview can rewrite it
 * when the box is clicked. A box that doesn't head a list item (say, in an
 * indented code block) stays as typed.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAsides, keepWritten, readLines, placeholder, MARKS, unplaced, splitText, sections, multipliers, escapeHtml, escapeAttr, addClass } from '../source.js';
import { schemeRule } from '../scheme.js';

const TASK = /^([ \t]*(?:>[ \t]*|~(?![^\s~])[ \t]*|~[^\s~]+[ \t]+)*(?:[-*+]|\d{1,9}[.)])[ \t]+)(?:((?:\[[ xX]\]){1,9})|\(([ xX])\))(?=[ \t]|$)/;
const NAMED = new Set(['count', 'ingredient_key', 'ingredient_use']);
const HEADING = /^( {0,3}#{1,6}[ \t]+)\[([ xX])\](?=[ \t]|$)/;
const [OPEN, CLOSE] = MARKS.tasks;
const PLACED = new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g');
const AT_HEAD = new RegExp(`^${OPEN}(\\d+)${CLOSE}[ \\t]?`);

export function tasks(md) {
  beforeAsides(md, 'task_lines', (state) => {
    const boxes = [];
    readLines(state, (line, n) => {
      const written = HEADING.test(line) ? HEADING : TASK;
      return line.replace(written, (m, lead, box, radio) => {
        const radioButton = box === undefined;
        // A heading's one box is its mark alone.
        const marks = radioButton ? [radio] : box.length === 1 ? [box] : [...box.matchAll(/\[([ xX])\]/g)].map((b) => b[1]);
        if (marks.length > 1) {
          // At stage k, the first k boxes are filled.
          const at = (k) => line.replace(written, (t, l) => `${l}${marks.map((_, j) => `[${j < k ? 'x' : ' '}]`).join('')}`);
          const stage = marks.filter((x) => x !== ' ').length;
          const lines = marks.map((_, k) => at(k)).concat(at(marks.length));
          // The line as it's written, whatever order or case its marks are in.
          lines[stage] = line;
          boxes.push({ line: n, staged: true, stage, checked: stage === marks.length, lines });
        } else {
          const mark = marks[0];
          const checked = mark !== ' ';
          const as = (on) => (checked && on ? line : line.replace(written, (t, l, b) => `${l}${b ? '[' : '('}${on ? 'x' : ' '}${b ? ']' : ')'}`));
          boxes.push({ line: n, radio: radioButton, mark, checked, on: as(true), off: as(false) });
        }
        return `${lead}${placeholder(OPEN, CLOSE, boxes.length - 1)}`;
      });
    });
    // Shared with the asides' own parses.
    if (boxes.length) state.env.tasks = { boxes };
  });

  md.core.ruler.push('task_tokens', (state) => {
    const tasks = state.env.tasks;
    if (!tasks) return;
    const tokens = state.tokens;
    // Lists are counted through the whole document, a deck's slides and
    // the asides' own parses, so each list's choices are a group of their own.
    const count = state.env.shared ?? tasks;
    const lists = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') lists.push(count.taskLists = (count.taskLists ?? 0) + 1);
      else if (t.type === 'bullet_list_close' || t.type === 'ordered_list_close') lists.pop();
      else if (t.type === 'list_item_open' || t.type === 'heading_open') {
        const heading = t.type === 'heading_open';
        const inline = tokens[i + 1]?.type === 'paragraph_open' ? tokens[i + 2] : tokens[i + 1];
        const first = inline?.type === 'inline' ? inline.children?.[0] : null;
        const m = first?.type === 'text' && AT_HEAD.exec(first.content);
        const box = m && tasks.boxes[Number(m[1])];
        if (!box) continue;
        addClass(t, heading ? 'task-heading' : 'task');
        if (box.staged && !heading) addClass(t, box.checked ? 'staged task-done' : 'staged');
        first.content = first.content.slice(m[0].length);
        const input = new state.Token('task_box', 'input', 0);
        input.meta = { ...box, group: lists.at(-1), name: nameOf(inline.children) };
        inline.children.unshift(input);
      }
    }
    // Anywhere else, a box goes back to what was typed.
    const typed = (k) => {
      const box = tasks.boxes[k];
      if (box.staged) return box.lines[box.stage].match(/(?:\[[ xX]\])+/)[0];
      return box.radio ? `(${box.mark})` : `[${box.mark}]`;
    };
    splitText(state, PLACED, (k) => {
      if (!tasks.boxes[k]) return null;
      const t = new state.Token('text', '', 0);
      t.content = typed(k);
      return t;
    });
    for (const t of tokens) {
      if (t.type === 'code_block' || t.type === 'fence') t.content = t.content.replace(PLACED, (m, k) => typed(Number(k)));
    }
  });

  schemeRule(md, {
    name: 'reset',
    scheme: 'reset',
    path: /(?:)/,
    make: (state, where, label) => {
      if (state) state.push('task_reset', 'button', 0).meta = { label: label.trim() || 'Start over' };
      return true;
    },
  });
  // A reset clears the boxes of its section, by their lines in the file;
  // with a log in the section, it can add to it, and say the multiple.
  keepWritten(md);
  md.core.ruler.push('task_reset_sections', (state) => {
    if (state.inlineMode) return;
    const { list, of } = sections(state);
    const { bySection, nearest } = multipliers(state, of);
    state.tokens.forEach((block, i) => {
      for (const t of block.children ?? []) {
        if (t.type !== 'task_reset') continue;
        const section = of[i];
        t.meta.section = section;
        t.meta.multiplier = bySection.get(nearest(section));
        const log = list.find((s) => LOG.test(s.title) && s !== section && under(s, section));
        if (log) t.meta.log = { at: logEnd(state, log), level: Math.min(6, log.level + 1) };
      }
    });
  });

  md.renderer.rules.task_reset = (tokens, i, options, env) => {
    // An exported page has no script to press it with.
    if (env.exported) return '';
    const { label, section, log, multiplier } = tokens[i].meta;
    const to = section && section.end !== Infinity ? ` data-to="${section.end}"` : '';
    const reset = `<button type="button" class="task-reset" data-from="${section?.line ?? 0}"${to}>${escapeHtml(label)}</button>`;
    if (!log) return reset;
    const by = multiplier?.id ? ` data-multiplier="${multiplier.id}"` : '';
    return `${reset} <button type="button" class="task-log" data-at="${log.at}" data-level="${log.level}"${by}>Log today</button>`;
  };

  md.renderer.rules.task_box = (tokens, i, options, env) => {
    if (tokens[i].meta.staged) return stageBox({ ...tokens[i].meta, stages: stagesOf(env), exported: env.exported });
    const { line, radio, checked, on, off, group, name, notExported } = tokens[i].meta;
    // A box another feature shows in its own way (see source.js's tags).
    if (notExported && env.exported) return '';
    const lines = ` data-on="${escapeAttr(on)}" data-off="${escapeAttr(off)}"${name ? ` aria-label="${escapeAttr(name)}"` : ''}${checked ? ' checked' : ''}`;
    return radio
      ? `<input type="radio" class="choice-box" name="choice-${group}" data-line="${line}"${lines}> `
      : `<input type="checkbox" class="task-box" data-line="${line}"${lines}> `;
  };
}

const LOG = /^log$/i;
const BLANK = /^\s*(?:(?:[-*_][ \t]*){3,})?$/;

/** Whether section `s` is inside `around`. */
function under(s, around) {
  for (let p = s.parent; p; p = p.parent) if (p === around) return true;
  return false;
}

/** The line after a log's last entry: past it are only blank lines, or a rule before what's next. */
function logEnd(state, log) {
  const base = state.env.lineBase ?? 0;
  const lines = state.env.written ?? state.src.split('\n');
  let end = Math.min(log.end, base + lines.length);
  while (end - 1 > log.line && BLANK.test(lines[end - 1 - base] ?? '')) end--;
  return end;
}

/**
 * The stages' names the front matter gives, `multibox: stages:`, or a
 * slide's deck's; null when it gives none.
 */
function stagesOf(env) {
  const named = env.frontMatter?.multibox?.stages || env.matter?.multibox?.stages;
  return typeof named === 'string' && named.trim() ? named.split(',').map((p) => p.trim()) : null;
}

/**
 * A box with stages, drawn as a pip for each, those reached filled; its
 * stage named when the front matter names it. On an exported page, only a
 * picture of one.
 */
function stageBox({ line, stage, lines, stages, name, exported }) {
  const n = lines.length - 1;
  const called = (k) => stages?.[k - 1] ?? `${k} of ${n}`;
  const now = stage ? called(stage) : 'not started';
  const label = `${name ? `${name}: ` : ''}${now}${stages?.[stage - 1] ? ` (${stage} of ${n})` : ''}`;
  const next = stage < n ? `; next, ${called(stage + 1)}` : '';
  const pips = lines.slice(1).map((_, k) => `<i${k < stage ? ' class="on"' : ''}></i>`).join('');
  const shown = stages?.[stage - 1] && stage < n ? ` <span class="stage-name">${escapeHtml(stages[stage - 1])}</span>` : '';
  // An exported page has no script to fill it with: it only says how far it's got.
  if (exported) return `<span class="stage-box" role="img" aria-label="${escapeAttr(label)}" title="${escapeAttr(now)}">${pips}</span>${shown} `;
  return `<button type="button" class="stage-box" role="checkbox" aria-checked="${stage === n ? 'true' : stage ? 'mixed' : 'false'}"`
    + ` aria-label="${escapeAttr(label)}" title="${escapeAttr(`${now}${next}`)}" data-line="${line}" data-stage="${stage}"`
    + ` data-lines="${escapeAttr(JSON.stringify(lines))}">${pips}</button>${shown} `;
}

/**
 * What a box is for, as a screen reader says it: the words beside it. A
 * label around them would make every link among them tick the box too.
 */
function nameOf(children) {
  // Words other features set apart (a count, an ingredient) carry theirs too.
  const words = children.filter((t) => t.type === 'text' || t.type === 'code_inline' || NAMED.has(t.type)).map((t) => t.content);
  return unplaced(words.join('')).replace(/\s+/g, ' ').trim();
}

export default {
  name: 'tasks',
  plugin: tasks,
  css: fs.readFileSync(new URL('./tasks.css', import.meta.url), 'utf8'),
  // Drawn into the preview frame, to make it clickable.
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
  // Reads the file as written, before the features that don't.
  raw: true,
};
