import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';

test('[text]{…} styles a span with a color and fonts', () => {
  const { body } = render('[red *text*]{red} [x]{Blue times-new-roman monospace} `[y]{red}`\n');
  assert.match(body, /<span style="color: red">red <em>text<\/em><\/span>/);
  assert.match(body, /<span class="font" style="color: blue; --font: 'times new roman', monospace">x<\/span>/);
  assert.match(body, /<code>\[y\]\{red\}<\/code>/);
});

test('::: styles every block until the closing :::', () => {
  const src = '::: red georgia\n# H\n\ntext\n- [ ] task\n\n| a | b |\n|---|--:|\n| 1 | 2 |\n\n---\n\n    [c]{red}\n\n~ aside\n:::\n\nafter\n\n:::\n';
  const { body } = render(src);
  const style = `class="font" style="color: red; --font: 'georgia'"`;
  assert.match(body, new RegExp(`<h1 ${style}>H</h1>`));
  assert.match(body, new RegExp(`<p ${style}>text</p>`));
  assert.match(body, /<li class="font task" style="[^"]*"><input type="checkbox" class="task-box" data-line="4" [^>]*> task<\/li>/);
  assert.match(body, /<td class="font" style="text-align:right; color: red; --font: 'georgia'">2<\/td>/);
  assert.match(body, /<hr>/);
  assert.match(body, /<code>\[c\]\{red\}\n<\/code>/);
  assert.match(body, new RegExp(`<p ${style}><span class="gm-mark">~</span>aside</p>`));
  assert.match(body, /<p>after<\/p>\n<p>:::<\/p>/);
  assert.doesNotMatch(body, /[\uE000-\uE007]/);
});

test('nested ::: blocks take the innermost color and font first', () => {
  const { body } = render('::: red georgia\n::: blue\ninner\n:::\nouter\n:::\n');
  assert.match(body, /<p class="font" style="color: blue; --font: 'georgia'">inner<\/p>/);
  assert.match(body, /<p class="font" style="color: red; --font: 'georgia'">outer<\/p>/);
});

test('a span can hold a link, and a link a span', () => {
  const { body } = render('[see [x](https://x.test)]{red} and [[y]{blue}](https://y.test)\n');
  assert.match(body, /<span style="color: red">see <a href="https:\/\/x\.test">x<\/a><\/span>/);
  assert.match(body, /<a href="https:\/\/y\.test"><span style="color: blue">y<\/span><\/a>/);
});

test('an image, an escape, or braces that name nothing are not a span', () => {
  const { body } = render('![a]{red} \\[b]{red} [c]{} [d]{red!}\n');
  assert.doesNotMatch(body, /<span/);
});

test('a ::: block styles quotes, tasks, exchanges and fields inside it', () => {
  const { body } = render('::: red\n> quoted\n- [ ] task\nQ: asked\n\n@ Name: x\n:::\n');
  assert.match(body, /<blockquote>\n<p style="color: red">quoted<\/p>/);
  assert.match(body, /<li class="task" style="color: red"><input type="checkbox"/);
  assert.match(body, /<li class="qa qa-q" style="color: red"><span class="qa-label">Q<\/span>asked<\/li>/);
  assert.match(body, /<p style="color: red"><span class="field" data-line="5"/);
});

test('a ::: with nothing open stays as typed, and code inside a block is left alone', () => {
  const { body } = render(':::\n\n::: red\n```\ncode\n```\n    indented\n:::\n');
  assert.match(body, /<p>:::<\/p>/);
  assert.match(body, /<pre><code>code\n<\/code><\/pre>/);
  assert.match(body, /<pre><code>indented\n<\/code><\/pre>/);
});

test('an aside in a ::: block keeps its mark', () => {
  const { body } = render('::: red\n~ aside\n:::\n');
  assert.match(body, /<p style="color: red"><span class="gm-mark">~<\/span>aside<\/p>/);
});

test('the stylesheet comes with the feature', () => {
  assert.match(render('x\n').css, /\.font \{ font-family: var\(--font\), var\(--gm-serif\); \}/);
});
