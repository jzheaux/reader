/**
 * An image's size goes after its address as `=WxH`, in pixels, as in the
 * markdown-it-imsize convention. Leave one side out to keep the image's
 * proportions: `=100x` sets only the width, `=x200` only the height. A title
 * still goes before it.
 *
 *   ![](logo.svg =x200)
 *   ![a cat](cat.jpg "Ginger, 2019" =320x)
 *
 * markdown doesn't read a size there, so before it reads the text, the size
 * is moved into the image's title between two markers; once parsed, it
 * comes back out of the title as the image's style. A style rather than
 * width and height attributes, which `height: auto` would beat.
 */

import { beforeAsides, readLines } from '../source.js';

const OPEN = '\uE00E';
const CLOSE = '\uE00F';
const IMG_SIZE = /!\[([^\]\n]*)\]\([ \t]*(<[^>\n]*>|[^\s()]+)(?:[ \t]+("[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?[ \t]+=(\d*)x(\d*)[ \t]*\)/g;
const SIZED = new RegExp(`^${OPEN}(\\d*)x(\\d*)${CLOSE}`);
const CODE_SPAN = /(`+)[^`][\s\S]*?\1|`+/g;

export function sizes(md) {
  beforeAsides(md, 'size_lines', (state) => readLines(state, (line) => outsideCode(line, (text) => text
    .replace(IMG_SIZE, (m, alt, src, title, w, h) => {
      if (!w && !h) return m;
      const inner = title ? title.slice(1, -1).replace(/\\?"/g, '\\"') : '';
      return `![${alt}](${src} "${OPEN}${w}x${h}${CLOSE}${inner}")`;
    }))));

  md.core.ruler.push('size_images', (state) => {
    const walk = (children) => {
      for (const t of children || []) {
        if (t.type === 'image') size(t);
        if (t.children) walk(t.children);
      }
    };
    for (const block of state.tokens) if (block.type === 'inline') walk(block.children);
  });
}

/** The size in an image's title becomes its style; the title goes back to what was written. */
function size(image) {
  const title = image.attrGet('title');
  const m = title && SIZED.exec(title);
  if (!m) return;
  const rest = title.slice(m[0].length);
  if (rest) image.attrSet('title', rest);
  else image.attrs = image.attrs.filter(([name]) => name !== 'title');
  image.attrSet('style', [m[1] && `width: ${m[1]}px`, m[2] && `height: ${m[2]}px`].filter(Boolean).join('; '));
}

/** `fn` over the parts of `line` outside code spans. */
function outsideCode(line, fn) {
  let out = '';
  let pos = 0;
  for (const m of line.matchAll(CODE_SPAN)) {
    out += fn(line.slice(pos, m.index)) + m[0];
    pos = m.index + m[0].length;
  }
  return out + fn(line.slice(pos));
}

export default {
  name: 'sizes',
  plugin: sizes,
};
