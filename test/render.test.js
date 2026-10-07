import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, emojify, expand, searchLink, math } from '../src/render.js';
import { ldsLink } from '../src/lds.js';

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

test('scripture references become Blue Letter Bible links', () => {
  const { body } = render(
    'scripture:[Isaiah 2:1-5] and scripture:[Isaiah 2:1-5, NIV]\n\n~ scripture:isaiah/2/1-5[plowshares]\n',
  );
  assert.match(body, /<a href="https:\/\/www\.blueletterbible\.org\/rsv\/isaiah\/2\/1-5">Isaiah 2:1-5<\/a>/);
  assert.match(body, /<a href="https:\/\/www\.blueletterbible\.org\/niv\/isaiah\/2\/1-5">Isaiah 2:1-5, NIV<\/a>/);
  assert.match(body, /<a href="https:\/\/www\.blueletterbible\.org\/rsv\/isaiah\/2\/1-5">plowshares<\/a>/);
});

test('scripture books, chapters and dashes', () => {
  assert.equal(expand('scripture:[Psalm 23]'), '[Psalm 23](https://www.blueletterbible.org/rsv/psalm/23)');
  assert.equal(
    expand('scripture:[1 John 4:7\u20138, KJV]'),
    '[1 John 4:7\u20138, KJV](https://www.blueletterbible.org/kjv/1john/4/7-8)',
  );
  assert.equal(expand('scripture:isaiah/2/1-5[]'), '[isaiah/2/1-5](https://www.blueletterbible.org/rsv/isaiah/2/1-5)');
});

test('scripture in code, unreadable references and other words are left alone', () => {
  for (const src of [
    '`scripture:[Micah 4:3]`',
    '```\nscripture:[Micah 4:3]\n```',
    'scripture:[hello]',
    'noscripture:[Micah 4:3]',
  ]) {
    assert.equal(expand(src), src);
  }
});

test('rfc: links to the RFC Editor', () => {
  assert.equal(expand('rfc:9110[]'), '[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)');
  assert.equal(
    expand('rfc:9110#section-15.5[]'),
    '[RFC 9110 §15.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5)',
  );
  assert.equal(
    expand('rfc:6749#appendix-A[]'),
    '[RFC 6749 Appendix A](https://www.rfc-editor.org/rfc/rfc6749.html#appendix-A)',
  );
  assert.equal(expand('rfc:6749[OAuth 2.0]'), '[OAuth 2.0](https://www.rfc-editor.org/rfc/rfc6749.html)');
  for (const src of ['`rfc:9110[]`', 'rfc:9110 alone', 'xrfc:9110[]', '```\nrfc:9110[]\n```']) {
    assert.equal(expand(src), src);
  }
});

test('an image alone in a paragraph is a captioned figure', () => {
  const { body } = render('![a cat](cat.jpg "Ginger, 2019")\n\n![a dog](dog.png)\n\nsee ![x](x.png) inline\n');
  assert.match(body, /<figure><img src="cat\.jpg" alt="a cat" title="Ginger, 2019"><figcaption>Ginger, 2019<\/figcaption><\/figure>/);
  assert.match(body, /<figure><img src="dog\.png" alt="a dog"><figcaption>a dog<\/figcaption><\/figure>/);
  assert.match(body, /<p>see <img src="x\.png" alt="x"> inline<\/p>/);
});

test('GitHub alerts become callouts', () => {
  const { body } = render('> [!WARNING]\n> careful\n\n> [!tip]\n>\n> one\n>\n> two\n\n> [!NOPE]\n> plain\n');
  assert.match(body, /<blockquote class="alert alert-warning">\n<p class="alert-title"><span aria-hidden="true">⚠️<\/span> Warning<\/p>\n<p>careful<\/p>/);
  assert.match(body, /<blockquote class="alert alert-tip">\n<p class="alert-title">.*Tip<\/p>\n<p>one<\/p>\n<p>two<\/p>/);
  assert.match(body, /<blockquote>\n<p>\[!NOPE\]\nplain<\/p>/);
});

test('arrows, but not in code, comments or when escaped', () => {
  assert.equal(expand('a -> b <- c <-> d'), 'a → b ← c ↔ d');
  for (const src of ['`a -> b`', '<!-- x -->', '\\-> and \\<-', '```\n->\n```', 'a => b <= c']) {
    assert.equal(expand(src), src);
  }
});

test('search: links to Google, the same with pluses or brackets', () => {
  assert.deepEqual(searchLink('my+many+worded+term', 'My Many Worded Term'), {
    href: 'https://www.google.com/search?q=my+many+worded+term',
    label: 'My Many Worded Term',
  });
  assert.deepEqual(searchLink('', 'My Many Worded Term'), {
    href: 'https://www.google.com/search?q=My+Many+Worded+Term',
    label: 'My Many Worded Term',
  });
  assert.deepEqual(searchLink('a+b', ''), { href: 'https://www.google.com/search?q=a+b', label: 'a b' });
  assert.equal(searchLink('', ' '), null);
  const { body } = render('search:[comensality] and `search:[x]` and nosearch:[x]\n');
  assert.match(body, /<a class="search" href="https:\/\/www\.google\.com\/search\?q=comensality">comensality<\/a>/);
  assert.match(body, /<code>search:\[x\]<\/code> and nosearch:\[x\]/);
});

test('a blockquote closing with -- gets an attribution', () => {
  const { body } = render(
    '> The road of excess\n> -- [William Blake](https://x.test)\n\n> one\n>\n> -- scripture:[Psalm 23]\n\n> a\n> -- b\n> c\n',
  );
  assert.match(body, /<p>The road of excess<\/p>\n<p class="quote-by"><a href="https:\/\/x\.test">William Blake<\/a><\/p>/);
  assert.match(body, /<p class="quote-by"><a href="https:\/\/www\.blueletterbible\.org\/rsv\/psalm\/23">Psalm 23<\/a><\/p>/);
  assert.match(body, /<p>a\n– b\nc<\/p>/);
});

test('tables render', () => {
  const { body } = render('| a | b |\n|---|:-:|\n| 1 | 2 |\n');
  assert.match(body, /<table>\n<thead>\n<tr>\n<th>a<\/th>\n<th style="text-align:center">b<\/th>/);
});

const LDS = 'https://www.churchofjesuschrist.org/study/scriptures';

test('scripture-lds: links to the standard works by book', () => {
  const href = (ref) => ldsLink('', ref)?.href;
  assert.equal(href('D&C 88:26'), `${LDS}/dc-testament/dc/88?lang=eng&id=p26#p26`);
  assert.equal(href('Doctrine and Covenants 88'), `${LDS}/dc-testament/dc/88?lang=eng`);
  assert.equal(href('1 Ne 3:7'), `${LDS}/bofm/1-ne/3?lang=eng&id=p7#p7`);
  assert.equal(href('Words of Mormon 1:7'), `${LDS}/bofm/w-of-m/1?lang=eng&id=p7#p7`);
  assert.equal(href('JS\u2014H 1:17\u201319, 25'), `${LDS}/pgp/js-h/1?lang=eng&id=p17-p19,p25#p17`);
  assert.equal(href('Articles of Faith 1:13'), `${LDS}/pgp/a-of-f/1?lang=eng&id=p13#p13`);
  assert.equal(href('A of F 13'), `${LDS}/pgp/a-of-f/1?lang=eng&id=p13#p13`);
  assert.equal(href('Isaiah 2:1-5'), `${LDS}/ot/isa/2?lang=eng&id=p1-p5#p1`);
  assert.equal(href('1 John 4:8'), `${LDS}/nt/1-jn/4?lang=eng&id=p8#p8`);
  assert.equal(href('Hesitations 3:1'), undefined);
  assert.deepEqual(ldsLink('dc/88/26', 'quickened'), { href: `${LDS}/dc-testament/dc/88?lang=eng&id=p26#p26`, label: 'quickened' });
  assert.equal(expand('scripture-lds:[Moroni 10:4]'), `[Moroni 10:4](${LDS}/bofm/moro/10?lang=eng&id=p4#p4)`);
  for (const src of ['scripture-lds:[hello]', '`scripture-lds:[Alma 32:21]`', 'scripture-lds:[Nope 1:1]']) {
    assert.equal(expand(src), src);
  }
});

test('math: sets operators as symbols', () => {
  assert.equal(math('recognition >> judgment'), 'recognition\u00A0\u226B judgment');
  assert.equal(math('a>=b'), 'a\u00A0\u2265 b');
  assert.equal(math('x != y, x ~= y, x <= y, x << y'), 'x\u00A0\u2260 y, x\u00A0\u2248 y, x\u00A0\u2264 y, x\u00A0\u226A y');
  assert.equal(math('a -> b <- c <-> d'), 'a\u00A0\u2192 b\u00A0\u2190 c\u00A0\u2194 d');
  assert.equal(math('self-worth - doubt * 2 +- inf .: -x'), 'self-worth \u2212 doubt\u00A0\u00D7 2\u00A0\u00B1 \u221E\u00A0\u2234 \u2212x');
});

test('math: alone on a line is displayed, and inline otherwise', () => {
  const { body } = render('math:[a >> b]\n\nso math:[a > b] here, `math:[c]`\n');
  assert.match(body, /<p class="math-display"><span class="math">a\u00A0\u226B b<\/span><\/p>/);
  assert.match(body, /so <span class="math">a\u00A0&gt; b<\/span> here, <code>math:\[c\]<\/code>/);
});

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

test('a fence naming a puzzle is wrapped for the preview, numbered in order', () => {
  const { body, puzzles } = render('```sudoku\n5 3 .\n```\n\n```js\nx\n```\n\n```sudoku\n.\n```\n', { puzzleBase: 2 });
  assert.equal(puzzles, 2);
  assert.match(body, /<div class="puzzle" data-kind="sudoku" data-puzzle="2" data-from="1" data-to="2"><pre><code class="language-sudoku">5 3 \.\n<\/code><\/pre><\/div>/);
  assert.match(body, /data-puzzle="3" data-from="9" data-to="10"/);
  assert.match(body, /<pre><code class="language-js">x\n<\/code><\/pre>/);
  assert.doesNotMatch(body, /data-kind="js"/);
});

test('a tracks fence is a puzzle too', () => {
  const { body, puzzles } = render('```tracks\n1\n━  1\nA: left 1  B: right 1\n```\n');
  assert.equal(puzzles, 1);
  assert.match(body, /<div class="puzzle" data-kind="tracks" data-puzzle="0" /);
});

test('a wordsearch fence is a puzzle too', () => {
  const { body } = render('```wordsearch\nA B\nC D\nwords: AB\n```\n');
  assert.match(body, /<div class="puzzle" data-kind="wordsearch" data-puzzle="0" /);
});

test('a coord fence is a puzzle too', () => {
  const { body } = render('```coord\ngrid: 4 x 4\n(0, 0) (1, 1)\nplotted: 0\n```\n');
  assert.match(body, /<div class="puzzle" data-kind="coord" data-puzzle="0" /);
});

test('a puzzle can keep its board in a file next to the document', () => {
  const files = { 'gc/mazes/one.maze': '+--+\n|SE|\n+--+\n' };
  const read = (p) => {
    if (p in files) return files[p];
    throw new Error(`no such file: ${p}`);
  };
  const src = '```maze mazes/one.maze\npath: R\n```\n\n```maze\n+--+\n|SE|\n+--+\n```\n\n```maze gone.maze\n```\n';
  const { body } = render(src, { file: 'gc/packet.md', read });
  const hosts = body.match(/<div class="puzzle"[^>]*>/g);
  assert.equal(hosts.length, 3);
  assert.match(hosts[0], /data-source="\+--\+\n\|SE\|\n\+--\+"/);
  assert.doesNotMatch(hosts[1], /data-source/);
  assert.match(hosts[2], /data-source-error="gone\.maze: no such file: gc\/gone\.maze"/);
});

test('a puzzle knows the lines inside its fence, even unclosed', () => {
  const { body } = render('# Hi\n\n```sudoku\n1 2\n3 4\n```\n\n```maze\n```\n\n```coord\ngrid: 1 x 1\n', { line: 10 });
  const hosts = body.match(/<div class="puzzle"[^>]*>/g);
  assert.match(hosts[0], /data-from="13" data-to="15"/);
  assert.match(hosts[1], /data-from="18" data-to="18"/);
  assert.match(hosts[2], /data-from="21" data-to="22"/);
});
