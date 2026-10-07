import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { ldsLink } from './lds.js';

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
  assert.match(render('scripture-lds:[Moroni 10:4]\n').body, /<a href="https:\/\/www\.churchofjesuschrist\.org\/study\/scriptures\/bofm\/moro\/10\?lang=eng&amp;id=p4#p4">Moroni 10:4<\/a>/);
  for (const src of ['scripture-lds:[hello]', '`scripture-lds:[Alma 32:21]`', 'scripture-lds:[Nope 1:1]']) {
    assert.doesNotMatch(render(`${src}\n`).body, /churchofjesuschrist/, src);
  }
});
