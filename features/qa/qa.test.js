import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';

test('Q: and A: lines become an exchange', () => {
  const { body } = render('- a bullet\nQ: Why?\nA (Thomas): Because.\n\n   More.\nQ (audience): And?\nA: So.\n\n\\A: plain\n');
  assert.match(body, /<li>a bullet<\/li>\n<\/ul>\n<ul>/);
  assert.match(body, /<li class="qa qa-q">\n<p><span class="qa-label">Q<\/span>Why\?<\/p>/);
  assert.match(body, /<li class="qa qa-a">\n<p><span class="qa-label">A<\/span><span class="qa-name">Thomas<\/span>Because\.<\/p>\n<p>More\.<\/p>/);
  assert.match(body, /<span class="qa-label">Q<\/span><span class="qa-name">audience<\/span>And\?/);
  assert.match(body, /<p>A: plain<\/p>/);
  assert.doesNotMatch(body, /[\uE000-\uE00C]/);
});

test('an exchange inside ::: is styled too', () => {
  const { body } = render('::: slategray\nQ: Styled?\nA: Yes.\n:::\n');
  assert.match(body, /<li class="qa qa-q" style="color: slategray"><span class="qa-label">Q<\/span>Styled\?<\/li>/);
  assert.match(body, /<li class="qa qa-a" style="color: slategray"><span class="qa-label">A<\/span>Yes\.<\/li>/);
});

test('a second A: or Q: in a row continues the one before', () => {
  const loose = render('Q: Why?\nA (Thomas): One.\n\nA: Two.\n\nA (Thomas): Three.\nA: Four.\nQ: So?\n').body;
  assert.match(loose, /<span class="qa-name">Thomas<\/span>One\.<\/p>\n<p>Two\.<\/p>\n<p>Three\.<\/p>\n<p>Four\.<\/p>\n<\/li>/);
  assert.equal(loose.match(/class="qa qa-a"/g).length, 1);

  const tight = render('A: b\nA: c\nA (Sarah): d\nA: e\nQ: f\nQ: g\n').body;
  assert.match(tight, /<span class="qa-label">A<\/span>b<span class="qa-para"><\/span>c<\/li>/);
  assert.match(tight, /<span class="qa-name">Sarah<\/span>d<span class="qa-para"><\/span>e<\/li>/);
  assert.match(tight, /<span class="qa-label">Q<\/span>f<span class="qa-para"><\/span>g<\/li>/);

  const apart = render('A: one\n\ntext\n\nA: two\n').body;
  assert.equal(apart.match(/class="qa qa-a"/g).length, 2);
  assert.doesNotMatch(loose + tight + apart, /[\uE000-\uE00D]/);
});

test('a name is markdown, never raw HTML', () => {
  const { body } = render('Q (<b>Ann</b> & co): Hi?\nA (Ann\'s *mom* -- "M"): Yes.\n');
  assert.match(body, /<span class="qa-name">&lt;b&gt;Ann&lt;\/b&gt; &amp; co<\/span>Hi\?/);
  assert.match(body, /<span class="qa-name">Ann’s <em>mom<\/em> – “M”<\/span>Yes\./);
});

test('code and asides are not exchanges', () => {
  const { body } = render('```\nQ: in code\n```\n\nsaid\n\n~ Q: my own question\n');
  assert.match(body, /<code>Q: in code\n<\/code>/);
  assert.match(body, /Q: my own question/);
  assert.doesNotMatch(body, /class="qa/);
});

test('an aside, like any line at the margin, ends the exchange', () => {
  const { body } = render('A (Ann): one\n~ a thought\nA (Ann): two\nA: three\n');
  assert.equal(body.match(/class="qa qa-a"/g).length, 2);
  assert.match(body, /two<span class="qa-para"><\/span>three/);
  assert.match(body, /a thought/);
});

test('the stylesheet comes with the feature', () => {
  assert.match(render('Q: x\n').css, /li\.qa \{/);
});

test('an escaped line keeps no backslash, even with no exchange about', () => {
  const { body } = render('text\n\n\\A: plain\n\n~ aside\n\\Q: in the aside\n');
  assert.match(body, /<p>A: plain<\/p>/);
  assert.match(body, /aside\nQ: in the aside/);
});

test('a name can be a link', () => {
  const { body } = render('Q (scripture:[John 3:16]): And?\nA ([Ann](https://x.test)): Yes.\n');
  assert.match(body, /<span class="qa-name"><a href="https:\/\/www\.blueletterbible\.org\/rsv\/john\/3\/16">John 3:16<\/a><\/span>And\?/);
  assert.match(body, /<span class="qa-name"><a href="https:\/\/x\.test">Ann<\/a><\/span>Yes\./);
});

test('a quote opening the line curls like any other', () => {
  const { body } = render('A (Ann): "Sparkle," she said.\n');
  assert.match(body, /<span class="qa-name">Ann<\/span>“Sparkle,” she said\./);
});
