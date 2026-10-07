import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { scriptureLink } from './index.js';

test('scripture references become Blue Letter Bible links', () => {
  const { body } = render(
    'scripture:[Isaiah 2:1-5] and scripture:[Isaiah 2:1-5, NIV]\n\n~ scripture:isaiah/2/1-5[plowshares]\n',
  );
  assert.match(body, /<a href="https:\/\/www\.blueletterbible\.org\/rsv\/isaiah\/2\/1-5">Isaiah 2:1-5<\/a>/);
  assert.match(body, /<a href="https:\/\/www\.blueletterbible\.org\/niv\/isaiah\/2\/1-5">Isaiah 2:1-5, NIV<\/a>/);
  assert.match(body, /<a href="https:\/\/www\.blueletterbible\.org\/rsv\/isaiah\/2\/1-5">plowshares<\/a>/);
});

test('scripture books, chapters and dashes', () => {
  assert.deepEqual(scriptureLink('', 'Psalm 23'), { href: 'https://www.blueletterbible.org/rsv/psalm/23', label: 'Psalm 23' });
  assert.deepEqual(scriptureLink('', '1 John 4:7\u20138, KJV'), {
    href: 'https://www.blueletterbible.org/kjv/1john/4/7-8',
    label: '1 John 4:7\u20138, KJV',
  });
  assert.deepEqual(scriptureLink('isaiah/2/1-5', ''), { href: 'https://www.blueletterbible.org/rsv/isaiah/2/1-5', label: 'isaiah/2/1-5' });
});

test('scripture in code, unreadable references and other words are left alone', () => {
  for (const src of [
    '`scripture:[Micah 4:3]`',
    '```\nscripture:[Micah 4:3]\n```',
    'scripture:[hello]',
    'noscripture:[Micah 4:3]',
    '\\scripture:[Micah 4:3]',
  ]) {
    assert.doesNotMatch(render(`${src}\n`).body, /blueletterbible/, src);
  }
});

test('the label is markdown, and the link can sit anywhere a link can', () => {
  const { body } = render('*see* scripture:[Psalm 23] | x\n---|--\n**scripture:psalm/23[the *shepherd*]** | y\n\nQ (scripture:[John 1:1]): z\n');
  assert.match(body, /<strong><a href="https:\/\/www\.blueletterbible\.org\/rsv\/psalm\/23">the <em>shepherd<\/em><\/a><\/strong>/);
  assert.match(body, /<span class="qa-name"><a href="https:\/\/www\.blueletterbible\.org\/rsv\/john\/1\/1">John 1:1<\/a><\/span>/);
});

test('emphasis around a link still pairs up', () => {
  const { body } = render('*see scripture:[Psalm 23] and search:[x]*\n');
  assert.match(body, /<p><em>see <a href="https:\/\/www\.blueletterbible\.org\/rsv\/psalm\/23">Psalm 23<\/a> and <a class="search"[^>]*>x<\/a><\/em><\/p>/);
});
