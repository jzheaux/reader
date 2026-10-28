import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';

const speaker = (src, opts) => /<div class="gm-speaker">\n([\s\S]*?)<\/div>\n<div(?: class="gm-asides")?>/.exec(render(src, opts).body)[1];
const tabs = (html) => [...html.matchAll(/<input type="radio" class="tab-pick" name="([^"]+)" value="([^"]+)"( checked)?>([^<]*)<\/label>/g)]
  .map(([, group, key, checked, label]) => `${group} ${key}${checked ? '*' : ''} ${label}`);

test('each block in a tabs block is a tab, named for its language, the first showing', () => {
  const html = speaker('::: tabs\n```java\nJava;\n```\n\n```kotlin\nKotlin\n```\n:::\n');
  assert.deepEqual(tabs(html), ['tabs-1 java* Java', 'tabs-1 kotlin Kotlin']);
  assert.match(html, /^<div class="tabs">\n<div class="tab-bar">\n<label class="tab">[^\n]*\n<label class="tab">[^\n]*\n<\/div>\n<div class="tab-pane" data-tab="java" data-label="Java">\n<pre>/);
  assert.match(html, /<div class="tab-pane" data-tab="kotlin" data-label="Kotlin">\n<pre><code class="hljs language-kotlin">Kotlin\n<\/code><\/pre>\n<\/div>\n<\/div>\n$/);
});

test('a tab is named for its fence\'s language, before any braces', () => {
  const html = speaker('::: tabs\n```java{1}\nJava;\n```\n\n```kotlin {numbers}\nKotlin\n```\n:::\n');
  assert.deepEqual(tabs(html), ['tabs-1 java* Java', 'tabs-1 kotlin Kotlin']);
});

test('a +++ line names the tab after it, and one before the first names it', () => {
  const html = speaker('::: tabs\n+++ Maven\n```xml\n<a/>\n```\nwith a word\n+++ Gradle\n```groovy\na\n```\n:::\n');
  assert.deepEqual(tabs(html), ['tabs-1 maven* Maven', 'tabs-1 gradle Gradle']);
  assert.match(html, /data-label="Maven">\n<pre>[\s\S]*<\/pre>\n<p>with a word<\/p>\n<\/div>/);
});

test('a tab with no name and no language is numbered, and each block is a group of its own', () => {
  const html = speaker('::: tabs\none\n\ntwo\n:::\n\n::: tabs\n```\nplain\n```\n:::\n');
  assert.deepEqual(tabs(html), ['tabs-1 1* 1', 'tabs-1 2 2', 'tabs-2 1* 1']);
});

test('other names on the fence are styles, and a name is text, not markup', () => {
  const html = speaker('::: tabs georgia\n+++ <b>&\none\n:::\n');
  assert.match(html, />&lt;b&gt;&amp;<\/label>/);
  assert.match(html, /<p class="font" style="--font: 'georgia'">one<\/p>/);
});

test('a +++ name in a columns block still only divides', () => {
  assert.match(speaker('::: columns\na\n+++ Right\nb\n:::\n'), /^<div class="columns">\n<div class="column">\n<p>a<\/p>\n<\/div>\n<div class="column">\n<p>b<\/p>\n<\/div>\n<\/div>\n$/);
});

test('compare sets the versions side by side, each headed by its tab', () => {
  const html = speaker('::: compare\n+++ NIV\nyou are my God\n+++ KJV\nthou art my God\n:::\n');
  assert.deepEqual(tabs(html), ['compare-1 niv* NIV', 'compare-1 kjv KJV']);
  assert.match(html, /^<div class="compare">\n<div class="compare-pane" data-tab="niv" data-label="NIV">\n<label class="tab">/);
});

test('compare marks the words each version has that another does not, by which', () => {
  const html = speaker('::: compare\n+++ NIV\nLORD, you are my God; I will exalt you.\n+++ KJV\nO Lord, thou art my God: I will exalt thee.\n:::\n');
  assert.match(html, /<p>LORD, <span class="diff" data-x="2">you are<\/span> my God; I will exalt <span class="diff" data-x="2">you\.<\/span><\/p>/);
  assert.match(html, /<p><span class="diff" data-x="1">O<\/span> Lord, <span class="diff" data-x="1">thou art<\/span> my God: I will exalt <span class="diff" data-x="1">thee\.<\/span><\/p>/);
});

test('with three versions, a word says each it is missing from', () => {
  const html = speaker('::: compare\na b c\n\na c\n\nb c\n:::\n');
  assert.match(html, /data-label="1">\n[^\n]*\n<p><span class="diff" data-x="3">a<\/span> <span class="diff" data-x="2">b<\/span> c<\/p>/);
  assert.match(html, /data-label="2">\n[^\n]*\n<p><span class="diff" data-x="3">a<\/span> c<\/p>/);
  assert.match(html, /data-label="3">\n[^\n]*\n<p><span class="diff" data-x="2">b<\/span> c<\/p>/);
});

test('compare reads the words in formatting and across paragraphs, and code apart from them', () => {
  const html = speaker('::: compare\n+++ A\none *two*\n\nthree\n+++ B\none\n\n*two* four\n\n```\nfive\n```\n:::\n');
  assert.match(html, /<p>one <em>two<\/em><\/p>\n<p><span class="diff" data-x="2">three<\/span><\/p>/);
  assert.match(html, /<p><em>two<\/em> <span class="diff" data-x="1">four<\/span><\/p>\n<pre><code><span class="diff" data-x="1">five<\/span>\n<\/code><\/pre>/);
});

test('the stylesheet shows the pane of the checked tab and marks words against the picked version', () => {
  const { css } = render('');
  assert.match(css, /\.tabs:has\(> \.tab-bar > \.tab:nth-child\(2\) > input:checked\) > \.tab-pane:nth-child\(3\)/);
  // Every pane is laid in one place, the others out of sight, so the block is as tall as the tallest.
  assert.match(css, /\.tab-pane:nth-child\(\d+\) \{ visibility: visible; \}/);
  assert.match(css, /\.tab-pane \{ grid-area: 2 \/ 1; visibility: hidden;/);
  assert.match(css, /\.compare:has\(> \.compare-pane:nth-child\(2\) > \.tab > input:checked\) > \.compare-pane:not\(:nth-child\(2\)\) \.diff\[data-x~="2"\]/);
});

test('compare marks code as written, each mark of punctuation a word, inside the highlighting', () => {
  const html = speaker('::: compare\n+++ Java\n\n```java\nSystem.out.println("Hello, world!");\n```\n\n+++ Kotlin\n\n```kotlin\nprint "Hello, world!"\n```\n:::\n');
  assert.match(html, /<code class="hljs language-java"><span class="diff" data-x="2">System\.out\.println\(<\/span><span class="hljs-string">&quot;Hello, world!&quot;<\/span><span class="diff" data-x="2">\);<\/span>\n<\/code>/);
  assert.match(html, /<code class="hljs language-kotlin"><span class="diff" data-x="1">print<\/span> <span class="hljs-string">&quot;Hello, world!&quot;<\/span>\n<\/code>/);
});

test('compare marks code in numbered lines, and not across them', () => {
  const html = speaker('::: compare\n```js {numbers}\nconst a = 1 < 2;\nx();\n```\n\n```js {numbers}\nlet a = 1 < 3;\nx();\n```\n:::\n');
  assert.match(html, /<span class="line"><span class="hljs-keyword"><span class="diff" data-x="2">const<\/span><\/span> a = <span class="hljs-number">1<\/span> &lt; <span class="hljs-number"><span class="diff" data-x="2">2<\/span><\/span>;<\/span>\n<span class="line"><span class="hljs-title function_">x<\/span>\(\);<\/span>/);
});

test('a fence drawn as something other than code is left unmarked', () => {
  const html = speaker('::: compare\n```number\n15%\nup\n```\n\n```number\n26%\nup\n```\n:::\n');
  assert.doesNotMatch(html, /class="diff"/);
});

test('tabs in a list item stay in it', () => {
  const html = render('1. item\n\n   ::: tabs\n   +++ One\n   first\n   +++ Two\n   second\n   :::\n2. next\n').body;
  assert.match(html, /<ol>\n<li>\n<p>item<\/p>\n<div class="tabs"[\s\S]*first[\s\S]*second[\s\S]*<\/div>\n<\/li>\n<li>\n<p>next<\/p>/);
  assert.doesNotMatch(html, /[\uE021-\uE023]/);
});
