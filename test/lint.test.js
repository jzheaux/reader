import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: fileURLToPath(new URL('..', import.meta.url)) });

/** The messages lint has for `code`, were it the file at `filePath`. */
async function lint(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((m) => m.message);
}

/** Asserts that `code`, at `filePath`, fails lint for reaching into features/`name`/. */
async function reaches(code, filePath, name) {
  const messages = await lint(code, filePath);
  assert.equal(messages.length, 1, messages.join('\n'));
  assert.match(messages[0], new RegExp(`^features/${name}/ is that feature's own`));
}

test('a feature importing another feature\'s files fails lint', async () => {
  await reaches("import { tasks } from '../tasks/index.js';\nexport { tasks };\n", 'features/steps/x.js', 'tasks');
});

test('a feature\'s nested file reaching another feature\'s nested file fails lint', async () => {
  await reaches("import { grid } from '../../tasks/kinds/grid.js';\nexport { grid };\n", 'features/steps/parts/x.js', 'tasks');
});

test('a feature re-exporting another feature\'s files fails lint', async () => {
  await reaches("export { tasks } from '../tasks/index.js';\n", 'features/steps/x.js', 'tasks');
  await reaches("export * from '../tasks/index.js';\n", 'features/steps/x.js', 'tasks');
});

test('a feature importing another feature\'s files when it runs fails lint', async () => {
  await reaches("export const load = () => import('../tasks/index.js');\n", 'features/steps/x.js', 'tasks');
});

test('a feature reading another feature\'s files by URL fails lint', async () => {
  await reaches("export const css = new URL('../tasks/tasks.css', import.meta.url);\n", 'features/steps/x.js', 'tasks');
  await reaches("export const dir = new URL('../tasks/', import.meta.url);\n", 'features/steps/x.js', 'tasks');
});

test('a feature may import what features share, its own files, and its tests the core', async () => {
  const code = "import { escapeAttr } from '../source.js';\nimport { render } from '../../src/render.js';\nimport { page } from '../../test/dom.js';\nimport { x } from './x.js';\nimport { y } from '../steps/y.js';\nexport const css = new URL('./steps.css', import.meta.url);\nexport const preview = new URL('preview.js', import.meta.url);\nexport { escapeAttr, render, page, x, y };\n";
  assert.deepEqual(await lint(code, 'features/steps/x.test.js'), []);
});

test('what features share importing a feature\'s files fails lint', async () => {
  await reaches("import { isOutput } from './highlight/callouts.js';\nexport { isOutput };\n", 'features/layout.js', 'highlight');
});

test('the core importing a feature\'s own files fails lint', async () => {
  await reaches("import { asideTokens } from '../features/asides/index.js';\nexport { asideTokens };\n", 'src/x.js', 'asides');
  await reaches("export const css = new URL('../features/asides/asides.css', import.meta.url);\n", 'src/x.js', 'asides');
});

test('the tests importing a feature\'s own files fails lint', async () => {
  await reaches("import { readEntry } from '../features/asides/key.js';\nexport { readEntry };\n", 'test/x.test.js', 'asides');
});

test('the core may import what features share', async () => {
  const code = "import { FEATURES } from '../features/index.js';\nimport { COLORS } from '../features/names.js';\nexport const dir = new URL('../features/', import.meta.url);\nexport { FEATURES, COLORS };\n";
  assert.deepEqual(await lint(code, 'src/x.js'), []);
});

test('the list of features alone may import a feature\'s index.js, and nothing else of it', async () => {
  assert.deepEqual(await lint("import tasks from './tasks/index.js';\nexport { tasks };\n", 'features/index.js'), []);
  await reaches("import { css } from './tasks/tasks.js';\nexport { css };\n", 'features/index.js', 'tasks');
  await reaches("import tasks from './tasks/index.js';\nexport { tasks };\n", 'features/names.js', 'tasks');
});
