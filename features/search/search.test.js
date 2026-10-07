import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { searchLink } from './index.js';

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

test('the stylesheet comes with the feature', () => {
  assert.match(render('x\n').css, /a\.search::after \{\n {2}content: "\\2315";/);
});
