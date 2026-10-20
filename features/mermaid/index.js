/**
 * A ```mermaid fence is drawn as a diagram: a flowchart, a sequence, a
 * state machine, whatever Mermaid reads.
 *
 *   ```mermaid
 *   flowchart LR
 *     draft --> review --> publish
 *   ```
 *
 * The server only wraps the fence, its text still inside as a code block,
 * so the page reads as the source anywhere nothing draws it:
 *
 *   <div class="mermaid" data-line="n">…the code block…</div>
 *
 * The block's attributes (its line, a `:::` block's style) go on the
 * wrapper, which is what stays on the page once the code is hidden.
 *
 * The preview frame draws it (preview.js), with Mermaid kept in vendor/,
 * loaded the first time a page has a diagram.
 *
 * A page with nothing to draw it (an export) is given what the frame drew,
 * `env.drawn.mermaid`, the SVG for each fence's text, and is written as the
 * frame leaves it:
 *
 *   <div class="mermaid drawn">…the code block…<div class="mermaid-figure">…the svg…</div></div>
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { addClass } from '../source.js';

const { Token } = MarkdownIt;

export function mermaids(md) {
  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, i, opts, env, self) => {
    const token = tokens[i];
    if (token.info.trim().split(/\s+/)[0] !== 'mermaid') return fence(tokens, i, opts, env, self);
    const attrs = token.attrs;
    token.attrs = null;
    const html = fence(tokens, i, opts, env, self);
    token.attrs = attrs;
    const wrapper = Object.assign(new Token('div', 'div', 1), { attrs: attrs?.map((a) => [...a]) ?? null });
    addClass(wrapper, 'mermaid');
    // The text the frame reads back from the code block (preview.js).
    const source = token.content.replace(/\n$/, '');
    const all = env.drawn?.mermaid;
    const svg = all && Object.hasOwn(all, source) && typeof all[source] === 'string' ? all[source] : null;
    if (svg) addClass(wrapper, 'drawn');
    const figure = svg ? `<div class="mermaid-figure">${svg}</div>` : '';
    return `<div${self.renderAttrs(wrapper)}>${html.replace(/\n$/, '')}${figure}</div>\n`;
  };
}

export default {
  name: 'mermaid',
  plugin: mermaids,
  css: fs.readFileSync(new URL('./mermaid.css', import.meta.url), 'utf8'),
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
  // Mermaid is big, and most pages have no diagram.
  lazy: fileURLToPath(new URL('./vendor/mermaid.min.js', import.meta.url)),
};
