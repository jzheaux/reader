/**
 * What goes with a code fence, after it: an `output` fence, what the code
 * prints, and a paragraph of notes on its marked lines, `<1> ...`. The
 * highlight feature draws them as one block with the fence
 * (highlight/callouts.js); a layout keeps them in the fence's pane
 * (layout.js).
 */

const NOTE = /^<(\d+)>\s*(?:-\s+)?(.*)$/;

/** The notes a paragraph's text makes, if it opens with one: `[{ n, text }]`. */
export function readNotes(text) {
  const notes = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const m = NOTE.exec(line);
    if (m) notes.push({ n: Number(m[1]), text: m[2] });
    else if (notes.length) notes.at(-1).text += `\n${line}`;
    else return [];
  }
  return notes;
}

/** Whether `t` is an `output` fence. */
export const isOutput = (t) => t?.type === 'fence' && t.info.trim() === 'output';
