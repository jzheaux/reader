import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import globals from 'globals';

const FEATURES = fileURLToPath(new URL('./features/', import.meta.url));

const FRAME = ['features/*/preview.js', 'features/puzzles/kinds/*.js'];

/**
 * The feature whose directory holds `file`, at any depth, or null for a
 * file outside every feature's: one at the top of features/, which
 * features share, or one elsewhere. `dir` says `file` is a directory.
 */
function featureOf(file, dir) {
  const [name, ...rest] = path.relative(FEATURES, file).split(path.sep);
  return name && name !== '..' && !path.isAbsolute(name) && (rest.length || dir) ? name : null;
}

/**
 * A feature is left out or bundled on its own, and the rest do without it,
 * so every file in features/<name>/ is that feature's own. Nothing outside
 * that directory refers to one of them, by an import, an `export ... from`,
 * an `import()` or a `new URL(..., import.meta.url)`, the way a feature
 * loads its CSS and its preview scripts. What features share sits at the
 * top of features/. A feature's one public part is its descriptor, the
 * default export of its index.js, and only features/index.js imports it.
 * A feature's own tests sit in its directory, and may reach ../../src/ and
 * ../../test/ as any file may.
 */
const features = {
  meta: {
    type: 'problem',
    messages: {
      private: "features/{{name}}/ is that feature's own: share what's needed from the top of features/, or go through features/index.js.",
    },
  },
  create(context) {
    const from = context.filename;
    const check = (node, specifier, relative) => {
      if (typeof specifier !== 'string' || !relative(specifier)) return;
      const to = path.resolve(path.dirname(from), specifier.replace(/[?#].*/, ''));
      const name = featureOf(to, /\/$/.test(specifier));
      if (!name || featureOf(from) === name) return;
      if (from === path.join(FEATURES, 'index.js') && to === path.join(FEATURES, name, 'index.js')) return;
      context.report({ node, messageId: 'private', data: { name } });
    };
    // An import's specifier is relative only as ./ or ../; a URL's is
    // unless it has a scheme or starts at the root.
    const imported = (s) => /^\.\.?(\/|$)/.test(s);
    const url = (s) => !/^([a-z][a-z\d+.-]*:|\/)/i.test(s);
    const literal = (node) => node?.type === 'Literal' ? node.value
      : node?.type === 'TemplateLiteral' && !node.expressions.length ? node.quasis[0].value.cooked : null;
    const source = (node) => node.source && check(node.source, literal(node.source), imported);
    return {
      ImportDeclaration: source,
      ExportNamedDeclaration: source,
      ExportAllDeclaration: source,
      ImportExpression: source,
      NewExpression(node) {
        const [where, base] = node.arguments;
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'URL') return;
        if (base?.type !== 'MemberExpression' || base.object.type !== 'MetaProperty' || base.property.name !== 'url') return;
        check(where, literal(where), url);
      },
    };
  },
};

export default [
  { ignores: ['node_modules/', 'static/vendor/', 'features/*/vendor/', 'desktop/dist/'] },
  js.configs.recommended,
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'no-unused-vars': ['error', { args: 'after-used', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      // Private-use characters are markers between passes; written raw they
      // can't be seen in the source. Spell them as escapes.
      'no-restricted-syntax': ['error',
        { selector: 'Literal[raw=/[\uE000-\uF8FF]/]', message: 'Write private-use characters as \\u escapes.' },
        { selector: 'TemplateElement[value.raw=/[\uE000-\uF8FF]/]', message: 'Write private-use characters as \\u escapes.' },
      ],
    },
  },
  // The server, the CLI, the desktop app, the renderer's features and the
  // tests, less what features draw into the preview frame, which has no Node.
  {
    files: ['bin/**/*.js', 'src/**/*.js', 'desktop/*.js', 'features/**/*.js', 'test/**/*.js', '*.config.js'],
    ignores: FRAME,
    languageOptions: { sourceType: 'module', globals: globals.node },
  },
  // Each feature's files are its own, as a package's are in Java: see
  // `features` above.
  {
    plugins: { reader: { rules: { features } } },
    rules: { 'reader/features': 'error' },
  },
  // The app and what it imports are modules; the preview frame's scripts
  // (its own, the puzzles' and the features') are classic scripts sharing
  // `window.Preview` and `window.Puzzles`, Mermaid's `window.mermaid`, and
  // `window.Ink` (ink.js). The app and the speaker view have `window.Theme`
  // (theme.js) and `window.Overview` (overview.js); the app and the preview
  // frame `window.Spoken` (spoken.js).
  {
    files: ['static/app/*.js', 'static/edits.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.browser, Theme: 'readonly', Overview: 'readonly', Spoken: 'readonly' } },
  },
  {
    files: ['static/preview-api.js', 'static/preview.js', 'static/ink.js', 'static/theme.js', 'static/speaker.js', 'static/overview.js', 'static/spoken.js', 'static/views.js', 'static/awake.js', ...FRAME],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, Preview: 'readonly', Puzzles: 'readonly', mermaid: 'readonly', Ink: 'readonly', Theme: 'readonly', Overview: 'readonly', Spoken: 'readonly' } },
  },
];
