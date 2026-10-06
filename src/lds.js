/**
 * `scripture-lds:` links to the standard works on churchofjesuschrist.org.
 *
 * Unlike Blue Letter Bible, the site files each book under its volume and a
 * short name of its own (`bofm/1-ne`, `dc-testament/dc`, `pgp/a-of-f`), so a
 * reference is looked up here rather than spelled into the address.
 */

const SITE = 'https://www.churchofjesuschrist.org/study/scriptures';

// volume -> [site name, full name, other names people write]
const VOLUMES = {
  ot: [
    ['gen', 'Genesis', 'gn'], ['ex', 'Exodus', 'exod'], ['lev', 'Leviticus'], ['num', 'Numbers'],
    ['deut', 'Deuteronomy'], ['josh', 'Joshua'], ['judg', 'Judges'], ['ruth', 'Ruth'],
    ['1-sam', '1 Samuel'], ['2-sam', '2 Samuel'], ['1-kgs', '1 Kings'], ['2-kgs', '2 Kings'],
    ['1-chr', '1 Chronicles'], ['2-chr', '2 Chronicles'], ['ezra', 'Ezra'], ['neh', 'Nehemiah'],
    ['esth', 'Esther'], ['job', 'Job'], ['ps', 'Psalms', 'psalm', 'psa'], ['prov', 'Proverbs'],
    ['eccl', 'Ecclesiastes', 'eccles'], ['song', 'Song of Solomon', 'song of songs'], ['isa', 'Isaiah'],
    ['jer', 'Jeremiah'], ['lam', 'Lamentations'], ['ezek', 'Ezekiel'], ['dan', 'Daniel'],
    ['hosea', 'Hosea', 'hos'], ['joel', 'Joel'], ['amos', 'Amos'], ['obad', 'Obadiah'],
    ['jonah', 'Jonah'], ['micah', 'Micah', 'mic'], ['nahum', 'Nahum'], ['hab', 'Habakkuk'],
    ['zeph', 'Zephaniah'], ['hag', 'Haggai'], ['zech', 'Zechariah'], ['mal', 'Malachi'],
  ],
  nt: [
    ['matt', 'Matthew', 'mt'], ['mark', 'Mark'], ['luke', 'Luke'], ['john', 'John'], ['acts', 'Acts'],
    ['rom', 'Romans'], ['1-cor', '1 Corinthians'], ['2-cor', '2 Corinthians'], ['gal', 'Galatians'],
    ['eph', 'Ephesians'], ['philip', 'Philippians', 'phil'], ['col', 'Colossians'],
    ['1-thes', '1 Thessalonians', '1 thess'], ['2-thes', '2 Thessalonians', '2 thess'],
    ['1-tim', '1 Timothy'], ['2-tim', '2 Timothy'], ['titus', 'Titus'], ['philem', 'Philemon'],
    ['heb', 'Hebrews'], ['james', 'James', 'jas'], ['1-pet', '1 Peter'], ['2-pet', '2 Peter'],
    ['1-jn', '1 John'], ['2-jn', '2 John'], ['3-jn', '3 John'], ['jude', 'Jude'],
    ['rev', 'Revelation', 'revelations'],
  ],
  bofm: [
    ['1-ne', '1 Nephi'], ['2-ne', '2 Nephi'], ['jacob', 'Jacob'], ['enos', 'Enos'], ['jarom', 'Jarom'],
    ['omni', 'Omni'], ['w-of-m', 'Words of Mormon'], ['mosiah', 'Mosiah'], ['alma', 'Alma'],
    ['hel', 'Helaman'], ['3-ne', '3 Nephi'], ['4-ne', '4 Nephi'], ['morm', 'Mormon'],
    ['ether', 'Ether'], ['moro', 'Moroni'],
  ],
  'dc-testament': [
    ['dc', 'Doctrine and Covenants', 'd&c', 'd and c'],
    ['od', 'Official Declaration', 'official declarations'],
  ],
  pgp: [
    ['moses', 'Moses'], ['abr', 'Abraham'], ['js-m', 'Joseph Smith—Matthew'],
    ['js-h', 'Joseph Smith—History'], ['a-of-f', 'Articles of Faith'],
  ],
};

const key = (name) => name.toLowerCase().replace(/[^a-z0-9&]/g, '');

// Every way of naming a book, squeezed of spaces and punctuation -> where it lives.
const BOOKS = new Map();
for (const [volume, books] of Object.entries(VOLUMES)) {
  for (const [slug, ...names] of books) {
    for (const name of [slug, ...names]) BOOKS.set(key(name), { volume, slug });
  }
}

const REFERENCE = /^((?:[1-4]\s*)?[a-z][a-z .&–—-]*?)\s*(\d+)(?::([\d\s,\-–]+))?$/i;

/**
 * `scripture-lds:[D&C 88:26]` and `scripture-lds:dc/88/26[label]` -> a link,
 * or null when the book isn't one the site carries. The Articles of Faith are
 * a single chapter, so `Articles of Faith 13` reads as 1:13.
 */
export function ldsLink(p, label) {
  const text = label.trim();
  const where = p.replace(/^\/+|\/+$/g, '');
  let book;
  let chapter;
  let verses;
  if (where) {
    [book, chapter, verses] = where.split('/');
    book = BOOKS.get(key(book));
  } else {
    const r = REFERENCE.exec(text);
    if (!r) return null;
    book = BOOKS.get(key(r[1]));
    [, , chapter, verses] = r;
  }
  if (!book || !/^\d+$/.test(chapter ?? '') || !/^[\d\s,\-\u2013]*$/.test(verses ?? '')) return null;
  if (book.slug === 'a-of-f' && !verses) [chapter, verses] = ['1', chapter];
  let href = `${SITE}/${book.volume}/${book.slug}/${Number(chapter)}?lang=eng`;
  const ranges = (verses ?? '').replace(/\s+/g, '').replace(/–/g, '-').split(',').filter(Boolean);
  if (ranges.length) {
    const id = ranges.map((r) => r.split('-').map((v) => `p${Number(v)}`).join('-')).join(',');
    href += `&id=${id}#p${Number(ranges[0].split('-')[0])}`;
  }
  return { href, label: text || where };
}
