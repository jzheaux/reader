import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';

test('=WxH after an image sets its size, either side optional', () => {
  const { body } = render('## Hi ![](a.svg =100x200)\n\n![logo](b.svg =x80)\n\n![cat](c.jpg "Ginger" =120x)\n');
  assert.match(body, /<h2>Hi <img src="a.svg" alt="" style="width: 100px; height: 200px"><\/h2>/);
  assert.match(body, /<img src="b.svg" alt="logo" style="height: 80px"><figcaption>logo</);
  assert.match(body, /<img src="c.jpg" alt="cat" title="Ginger" style="width: 120px"><figcaption>Ginger</);
  assert.doesNotMatch(body, /\uE00E|\uE00F|=\d/);
});

test('a size with no numbers, or in code, is left as written', () => {
  const { body } = render('![x](a.png =x)\n\n`![](a.png =1x2)`\n');
  assert.match(body, /!\[x\]\(a\.png =x\)/);
  assert.match(body, /<code>!\[\]\(a\.png =1x2\)<\/code>/);
});

test('a size in a fence, an aside or a link is handled like any image', () => {
  const { body } = render('```\n![](a.png =1x2)\n```\n\ntext\n\n~ ![](b.png =3x)\n\n[![](c.png =x4)](https://x.test)\n');
  assert.match(body, /<code>!\[\]\(a\.png =1x2\)\n<\/code>/);
  assert.match(body, /<img src="b.png" alt="" style="width: 3px">/);
  assert.match(body, /<a href="https:\/\/x\.test"><img src="c.png" alt="" style="height: 4px"><\/a>/);
});
