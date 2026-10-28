import js from '@eslint/js';
import globals from 'globals';

const FRAME = ['features/*/preview.js', 'features/puzzles/kinds/*.js'];

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
  // A feature is left out or bundled on its own, so it imports nothing from
  // another feature's directory: what two share sits at the top of
  // features/. Its tests may still reach ../../src/ and ../../test/.
  {
    files: ['features/*/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { regex: String.raw`^\.\./[^./][^/]*/`, message: 'Import what features share from the top of features/, not from another feature.' },
      ] }],
    },
  },
  // The core does without any one feature, so it imports only what
  // features share, at the top of features/, never a feature's own files.
  {
    files: ['src/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { regex: String.raw`^\.\./features/[^/]+/`, message: 'The core imports only what features share, at the top of features/, not a feature\'s own files.' },
      ] }],
    },
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
