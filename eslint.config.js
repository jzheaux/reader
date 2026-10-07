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
    files: ['static/preview-api.js', 'static/preview.js', 'static/puzzles.js', 'static/puzzles/*.js', 'features/*/preview.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, Preview: 'readonly', Puzzles: 'readonly' } },
  },
];
