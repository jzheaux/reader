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

test('a feature importing another feature\'s files fails lint', async () => {
  const messages = await lint("import { tasks } from '../tasks/index.js';\nexport { tasks };\n", 'features/steps/x.js');
  assert.equal(messages.length, 1);
  assert.match(messages[0], /Import what features share from the top of features\//);
});

test('a feature may import what features share, and its tests the core', async () => {
  const code = "import { escapeAttr } from '../source.js';\nimport { render } from '../../src/render.js';\nexport { escapeAttr, render };\n";
  assert.deepEqual(await lint(code, 'features/steps/x.test.js'), []);
});

test('the core importing a feature\'s own files fails lint', async () => {
  const messages = await lint("import { asideTokens } from '../features/asides/index.js';\nexport { asideTokens };\n", 'src/x.js');
  assert.equal(messages.length, 1);
  assert.match(messages[0], /The core imports only what features share/);
});

test('the core may import what features share', async () => {
  const code = "import { FEATURES } from '../features/index.js';\nimport { COLORS } from '../features/names.js';\nexport { FEATURES, COLORS };\n";
  assert.deepEqual(await lint(code, 'src/x.js'), []);
});
