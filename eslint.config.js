const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  prettier,
  {
    files: ['eslint.config.js', 'server.js', 'src/**/*.js'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
    },
  },
  {
    files: ['src/tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      sourceType: 'commonjs',
    },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: globals.browser,
      sourceType: 'script',
    },
  },
];
