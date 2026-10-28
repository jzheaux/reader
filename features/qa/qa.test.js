import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';

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

test('Good:, Bad: and Try: lines are cards, each one its own', () => {
  const { body } = render('Good (Josh): one\nGood (Josh): two\nA (Rob): agreed\nBad: three\n\nTry (Josh): four\n\n\\Good: plain\n');
  assert.equal(body.match(/class="qa qa-card qa-good"/g).length, 2);
  assert.match(body, /<li class="qa qa-card qa-good">\n<p><span class="qa-label qa-toggle"[^>]*>G<\/span><span class="qa-name">Josh<\/span>two<\/p>\n<\/li>\n<li class="qa qa-a">\n<p><span class="qa-label">A<\/span><span class="qa-name">Rob<\/span>agreed/);
  assert.match(body, /<li class="qa qa-card qa-bad">\n<p><span class="qa-label qa-toggle"[^>]*>B<\/span>three<\/p>/);
  assert.match(body, /<span class="qa-label qa-toggle qa-tried"[^>]*>T<\/span><span class="qa-name">Josh<\/span>four/);
  assert.match(body, /<p>Good: plain<\/p>/);
});

test('+1 under a card or a question is a vote, counted on it', () => {
  const { body } = render('Bad (Josh): late\n+1 (Rob)\n+1 (Joe): same, *again*\n+1\nA: so\n+1:\n\nQ: why?\n+1: me too\n');
  assert.match(body, /<span class="qa-label qa-toggle"[^>]*>B<\/span><span class="qa-tally">\+4<\/span><span class="qa-name">Josh<\/span>late/);
  assert.match(body, /<li class="qa qa-vote qa-bare">\n<p><span class="qa-label">\+1<\/span><span class="qa-name">Rob<\/span><\/p>/);
  assert.match(body, /<li class="qa qa-vote">\n<p><span class="qa-label">\+1<\/span><span class="qa-name">Joe<\/span>same, <em>again<\/em><\/p>/);
  assert.match(body, /<li class="qa qa-vote qa-bare">\n<p><span class="qa-label">\+1<\/span><\/p>\n<\/li>\n<li class="qa qa-a">/);
  assert.match(body, /<span class="qa-label">Q<\/span><span class="qa-tally">\+1<\/span>why\?/);
  assert.match(body, /<li class="qa qa-vote">\n<p><span class="qa-label">\+1<\/span>me too<\/p>/);
});

test('+1 with nothing to vote for stays as typed', () => {
  const { body } = render('+1 (Rob)\n\nGood: one\ntext\n+1\n\nA: two\n+1 (Ann)\n');
  assert.match(body, /<p>\+1 \(Rob\)<\/p>/);
  assert.match(body, /one\ntext\n\+1/);
  assert.doesNotMatch(body, /qa-vote|qa-tally/);
});

test('a card with [x] is done: it and what is said under it are faded', () => {
  const { body } = render('Good [x] (Josh): one\n+1 (Rob)\nA: yes\nQ: next\n\nBad [ ]: two\n\nQ [x]: plain\n');
  assert.match(body, /<li class="qa qa-card qa-good qa-done">/);
  assert.match(body, /<li class="qa qa-vote qa-bare qa-done">/);
  assert.match(body, /<li class="qa qa-a qa-done">/);
  assert.match(body, /<li class="qa qa-q">/);
  assert.match(body, /<li class="qa qa-card qa-bad">/);
  assert.match(body, /<p>Q \[x\]: plain<\/p>/);
});

test('a card\'s label is a toggle named for its card, pressed once discussed; in an export, only a label', () => {
  const src = 'Good [x] (Josh): one\n\nBad: two\n';
  const { body } = render(src);
  assert.match(body, /<span class="qa-label qa-toggle" role="button" tabindex="0" aria-label="Good, discussed" aria-pressed="true"[^>]*>G<\/span>/);
  assert.match(body, /<span class="qa-label qa-toggle" role="button" tabindex="0" aria-label="Bad, discussed" aria-pressed="false"[^>]*>B<\/span>/);
  const exported = render(src, { exported: true }).body;
  assert.doesNotMatch(exported, /qa-toggle|role="button"|data-on=/);
  assert.match(exported, /<li class="qa qa-card qa-good qa-done">\n<p><span class="qa-label">G<\/span>/);
});

test('on a slide, a card\'s label says whether it\'s done, but can\'t be reached or pressed', () => {
  const src = '# One\n\nGood [x] (Josh): one\n\nTry: two\n\n---\n\n# Next\n';
  const { body } = slides(src).slides[0];
  assert.match(body, /<span class="qa-label qa-toggle" role="button" aria-disabled="true" aria-label="Good, discussed" aria-pressed="true" data-line[^>]*>G<\/span>/);
  assert.match(body, /<span class="qa-label qa-toggle qa-tried" role="checkbox" aria-disabled="true" aria-label="Try, tried" aria-checked="false" data-line[^>]*>T<\/span>/);
  assert.doesNotMatch(body, /tabindex|title=/);
});

test('a card\'s label writes its line done, or not, as written', () => {
  const src = '---\ntitle: x\n---\nGood [x] (Josh): one rfc:9110[]\n\nBad [ ]: two\n\nTry: three\n';
  const toggles = [...render(src, { line: 10 }).body.matchAll(/data-line="(\d+)" data-on="([^"]*)" data-off="([^"]*)"/g)].map((m) => m.slice(1));
  assert.deepEqual(toggles, [
    ['13', 'Good [x] (Josh): one rfc:9110[]', 'Good (Josh): one rfc:9110[]'],
    ['15', 'Bad [x]: two', 'Bad [ ]: two'],
    ['17', 'Try [x]: three', 'Try: three'],
  ]);
  assert.match(render('Q: x\nA: y\n').body, /^(?![\s\S]*qa-toggle)/);
});

test('a Try card\'s label is a box, ticked once it\'s been tried', () => {
  const { body } = render('Try (Josh): half the cumin\n\nTry [x]: less salt\n');
  assert.match(body, /<span class="qa-label qa-toggle qa-tried" role="checkbox" tabindex="0" aria-label="Try, tried" aria-checked="false" title="Mark it tried"[^>]*>T<\/span>/);
  assert.match(body, /<li class="qa qa-card qa-try qa-done">\n<p><span class="qa-label qa-toggle qa-tried" role="checkbox"[^>]*aria-checked="true" title="Not tried yet"/);
});
