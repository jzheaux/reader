import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';

test('GitHub alerts become callouts', () => {
  const { body } = render('> [!WARNING]\n> careful\n\n> [!tip]\n>\n> one\n>\n> two\n\n> [!NOPE]\n> plain\n');
  assert.match(body, /<blockquote class="alert alert-warning">\n<p class="alert-title"><span aria-hidden="true">⚠️<\/span> Warning<\/p>\n<p>careful<\/p>/);
  assert.match(body, /<blockquote class="alert alert-tip">\n<p class="alert-title">.*Tip<\/p>\n<p>one<\/p>\n<p>two<\/p>/);
  assert.match(body, /<blockquote>\n<p>\[!NOPE\]\nplain<\/p>/);
});

test('an escaped tag, or one in an aside, is an ordinary quote', () => {
  const { body } = render('> \\[!NOTE]\n> text\n\nsaid\n\n~ > [!TIP]\n');
  assert.doesNotMatch(body, /class="alert/);
  assert.match(body, /<p>\[!NOTE\]\ntext<\/p>/);
});

test('an aside after a callout sits beside the callout', () => {
  const { body } = render('- > [!NOTE]\n~ a thought\n> # next\n');
  assert.match(body, /<blockquote class="alert alert-note">[\s\S]*?<\/ul>\n<\/div>\n<div class="gm-asides">[\s\S]*?a thought[\s\S]*?<\/section>\n<section class="gm-pair">\n<div class="gm-speaker">\n<blockquote>\n<h1>next/);
});
