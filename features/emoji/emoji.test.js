import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { emojify } from './index.js';

test('shortcodes become emoji in text and asides', () => {
  const { body } = render('Done :tada: :+1:\n\n~ so :heart: this\n');
  assert.match(body, /Done 🎉 👍/);
  assert.match(body, /so ❤️ this/);
  assert.doesNotMatch(body, /:tada:|:heart:/);
});

test('code, unknown names and times are left alone', () => {
  const { body } = render('`:tada:` and :not_an_emoji: at 10:30:45\n\n```\n:tada:\n```\n');
  assert.match(body, /<code>:tada:<\/code>/);
  assert.match(body, /<pre><code[^>]*>:tada:\n<\/code><\/pre>/);
  assert.match(body, /:not_an_emoji:/);
  assert.match(body, /10:30:45/);
});

test('attributes are never rewritten', () => {
  assert.equal(
    emojify('<a href="https://x.test/:tada:/">:tada:</a>'),
    '<a href="https://x.test/:tada:/">🎉</a>',
  );
});

test('a shortcode in the masthead, a caption or a field shows too', () => {
  const { body } = render('---\ntitle: Party :tada:\n---\n\n![a :cake: cake](c.png)\n\n@ Mood: :smile:\n');
  assert.match(body, /<h1 class="gm-title">Party 🎉<\/h1>/);
  assert.match(body, /alt="a :cake: cake"><figcaption>a 🍰 cake<\/figcaption>/);
  assert.match(body, /data-value=":smile:">😄<\/span>/);
});
