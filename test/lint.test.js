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
