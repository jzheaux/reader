import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { parseInfo, splitLines } from './index.js';

const fence = (info, code) => render(`\`\`\`${info}\n${code}\n\`\`\`\n`).body;

test('a fence in a known language is highlighted', () => {
  assert.match(fence('c', 'int x = 1;'), /<pre><code class="hljs language-c"><span class="hljs-type">int<\/span> x = <span class="hljs-number">1<\/span>;\n<\/code><\/pre>/);
  assert.match(fence('bash', 'echo hi'), /<span class="hljs-built_in">echo<\/span>/);
  assert.match(fence('asciidoc', '== Title'), /<code class="hljs language-asciidoc"><span class="hljs-section">== Title<\/span>/);
});

test('an unknown language, or none, is left plain', () => {
  assert.match(fence('nope', '<x> & y'), /<pre><code class="language-nope">&lt;x&gt; &amp; y\n<\/code><\/pre>/);
  assert.match(fence('', 'let a = 1'), /<pre><code>let a = 1\n<\/code><\/pre>/);
});

test('the info string: a language, then lines and numbering in braces', () => {
  const lines = (info) => {
    const { groups, ...rest } = parseInfo(info);
    return { ...rest, groups: groups.map((g) => [...g]) };
  };
  assert.deepEqual(lines('js'), { lang: 'js', numbers: false, groups: [] });
  assert.deepEqual(lines('js {3,5-7}'), { lang: 'js', numbers: false, groups: [[3, 5, 6, 7]] });
  assert.deepEqual(lines('js{numbers}'), { lang: 'js', numbers: true, groups: [] });
  assert.deepEqual(lines('js {1-2|4 numbers}'), { lang: 'js', numbers: true, groups: [[1, 2], [4]] });
  assert.deepEqual(lines('{2}'), { lang: '', numbers: false, groups: [[2]] });
  assert.deepEqual(lines('js {title}'), { lang: 'js', numbers: false, groups: [] });
});

test('a span across lines is closed and opened again at each break', () => {
  assert.deepEqual(splitLines('<span class="a">x\n<span class="b">y\nz</span></span> w'), [
    '<span class="a">x</span>',
    '<span class="a"><span class="b">y</span></span>',
    '<span class="a"><span class="b">z</span></span> w',
  ]);
});

test('picked-out lines stand out', () => {
  const body = fence('c {2}', '/* a\nb */\nint x;');
  assert.match(body, /<pre class="code-lines code-focus"><code class="hljs language-c">/);
  assert.match(body, /<span class="line"><span class="hljs-comment">\/\* a<\/span><\/span>\n<span class="line hl"><span class="hljs-comment">b \*\/<\/span><\/span>\n<span class="line">/);
});

test('numbered lines say how wide their numbers are', () => {
  assert.match(fence('{numbers}', Array(12).fill('x').join('\n')), /<pre class="code-lines code-numbers" style="--digits: 2"><code>(<span class="line">x<\/span>\n){12}<\/code>/);
});

test('ranges separated by | are steps, the first standing out from the start', () => {
  const body = fence('js {1|2-3|1}', 'a\nb\nc');
  assert.match(body, /<pre class="code-lines code-focus" data-focus-steps="3">/);
  assert.match(body, /<span class="line hl" data-focus="1 3">a<\/span>\n<span class="line" data-focus="2">b<\/span>\n<span class="line" data-focus="2">c<\/span>/);
});
