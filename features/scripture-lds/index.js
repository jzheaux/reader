/**
 * `scripture-lds:` makes a link to any of the standard works -- Bible, Book
 * of Mormon, Doctrine and Covenants, Pearl of Great Price -- on
 * churchofjesuschrist.org. Books go by their full names or the usual short
 * ones (`1 Ne`, `D&C`, `JS—H`, `A of F`); see lds.js.
 *
 *   scripture-lds:[D&C 88:26]          -> .../dc-testament/dc/88?lang=eng&id=p26#p26
 *   scripture-lds:dc/88/26[quickened]  -> the same, labelled "quickened"
 */

import { schemeLinks } from '../scheme.js';
import { ldsLink } from './lds.js';

export function scriptureLds(md) {
  schemeLinks(md, { name: 'scripture_lds', scheme: 'scripture-lds', path: /[\w/.:-]*/, link: ldsLink });
}

export default {
  name: 'scripture-lds',
  plugin: scriptureLds,
};
