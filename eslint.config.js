import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['coverage/**', 'dist/**', '.tmp/**'] },
  { ...js.configs.recommended, files: ['**/*.{js,cjs,mjs}'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
    rules: { 'no-console': ['error', { allow: ['warn', 'error'] }] },
  },
  {
    files: ['tests/**/*.ts', 'vite.config.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['scripts/**/*.cjs', 'tests/**/*.cjs'],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
