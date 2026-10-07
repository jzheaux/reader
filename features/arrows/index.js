/**
 * `->`, `<-` and `<->` show as arrows. A backslash (`\->`) keeps them as
 * typed, and so does code.
 *
 * Applied to the text once it's parsed, like markdown's own typographic
 * replacements, so what other syntax reads -- a search's query, a link's
 * address -- is still what was typed.
 */

const BOTH = /<->/g;
const RIGHT = /(?<![-<])->/g;
const LEFT = /<-(?![-<>])/g;

export function arrows(md) {
  // Before the typographer's own replacements, which make `--` a dash; and
  // before escaped characters join the text around them, so `\->` stays.
  md.core.ruler.before('replacements', 'arrows', (state) => {
    // An image's alt text is its own children's.
    const walk = (children) => {
      for (const t of children) {
        if (t.type === 'text') t.content = t.content.replace(BOTH, '\u2194').replace(RIGHT, '\u2192').replace(LEFT, '\u2190');
        else if (t.children) walk(t.children);
      }
    };
    for (const block of state.tokens) {
      if (block.type === 'inline' && block.children) walk(block.children);
    }
  });
}

export default {
  name: 'arrows',
  plugin: arrows,
};
