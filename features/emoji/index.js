/**
 * Emoji shortcodes like `:tada:` show as 🎉 in the rendered page but stay as
 * `:tada:` in the file. Code spans and unknown names are left as written.
 *
 * A pass over the finished page rather than its tokens, so a shortcode in
 * the masthead, a figure's caption or a filled-in field shows too.
 */

import EMOJI from 'markdown-it-emoji/lib/data/full.mjs';

const SHORTCODE = /:([a-z0-9_+-]+):/gi;
const RAW = new Set(['code', 'pre']);

/**
 * `:tada:` -> 🎉 in rendered text. The source keeps the shortcode; only the
 * preview shows the emoji. Tags and attributes are left alone, and so is
 * anything inside <code> or <pre>, where the colons are meant literally.
 * Unknown names stay as written.
 */
export function emojify(html) {
  let raw = 0;
  return html.replace(/(<[^>]*>)|([^<]+)/g, (m, tag, text) => {
    if (tag) {
      const t = /^<(\/?)([a-z0-9]+)/i.exec(tag);
      if (t && RAW.has(t[2].toLowerCase())) raw = Math.max(0, raw + (t[1] ? -1 : 1));
      return tag;
    }
    if (raw) return text;
    return text.replace(SHORTCODE, (code, name) => EMOJI[name.toLowerCase()] ?? code);
  });
}

export default {
  name: 'emoji',
  html: emojify,
};
