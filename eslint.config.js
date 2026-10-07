import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'static/vendor/'] },
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
  // The server, the CLI, the renderer's features and the tests.
  {
    files: ['bin/**/*.js', 'src/**/*.js', 'features/**/*.js', 'test/**/*.js', '*.config.js'],
    languageOptions: { sourceType: 'module', globals: globals.node },
  },
  // The app and what it imports are modules; the preview frame's scripts
  // (its own, the puzzles' and the features') are classic scripts sharing
  // `window.Preview` and `window.Puzzles`.
  {
    files: ['static/app.js', 'static/edits.js'],
    languageOptions: { sourceType: 'module', globals: globals.browser },
  },
  {
    files: ['static/preview-api.js', 'static/preview.js', 'static/speaker.js', 'features/*/preview.js', 'features/puzzles/kinds/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, Preview: 'readonly', Puzzles: 'readonly' } },
  },
];
