/**
 * GitHub's alerts: a blockquote opening with `[!NOTE]`, `[!TIP]`,
 * `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]` on a line of its own becomes
 * a boxed callout, headed with that kind's emoji and name. Elsewhere -- or
 * escaped, `\\[!NOTE]`, or in an aside -- it reads as an ordinary
 * blockquote.
 *
 *   > [!WARNING]
 *   > my information
 */

import fs from 'node:fs';
import { addClass } from '../source.js';

const ALERTS = {
  note: { icon: '📝', label: 'Note' },
  tip: { icon: '💡', label: 'Tip' },
  important: { icon: '❗', label: 'Important' },
  warning: { icon: '⚠️', label: 'Warning' },
  caution: { icon: '🛑', label: 'Caution' },
};

const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i;

export function alerts(md) {
  // Before an escaped bracket joins the text around it, so it can be told
  // from one that isn't.
  md.core.ruler.before('text_join', 'alerts', (state) => {
    // A callout is the speaker's, not a thought in the margin.
    if (state.env.__aside) return;
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const quote = tokens[i];
      if (quote.type !== 'blockquote_open' || quote.attrs) continue;
      const [open, inline] = [tokens[i + 1], tokens[i + 2]];
      if (open?.type !== 'paragraph_open' || inline?.type !== 'inline') continue;
      const [first, next] = inline.children;
      const m = first?.type === 'text' && ALERT.exec(first.content);
      if (!m || (next && next.type !== 'softbreak')) continue;
      const kind = m[1].toLowerCase();
      addClass(quote, `alert alert-${kind}`);
      const title = new state.Token('alert_title', 'p', 0);
      title.meta = ALERTS[kind];
      title.block = true;
      // On the line it was written, for an aside beside it to find.
      title.map = [open.map[0], open.map[0] + 1];
      if (next) {
        // The text on the lines after it stays in its paragraph.
        inline.children.splice(0, 2);
        tokens.splice(i + 1, 0, title);
      } else {
        // Alone in its paragraph, the paragraph goes.
        tokens.splice(i + 1, 3, title);
      }
    }
  });
  md.renderer.rules.alert_title = (tokens, i) => {
    const { icon, label } = tokens[i].meta;
    return `<p class="alert-title"><span aria-hidden="true">${icon}</span> ${label}</p>\n`;
  };
}

export default {
  name: 'alerts',
  plugin: alerts,
  css: fs.readFileSync(new URL('./alerts.css', import.meta.url), 'utf8'),
};
