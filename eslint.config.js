import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  prettierConfig,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
        svelteConfig,
      },
    },
  },
  {
    // レイヤー依存規則の機械的な強制(docs/architecture.md「依存規則の機械的な強制」)。
    // core/ と agents/ は決定性を壊す非決定 API と、外向きのレイヤー依存を禁止する。
    files: ['src/core/**/*.ts', 'src/agents/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'fetch',
        'console',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random' },
        { object: 'Date', property: 'now' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message:
            'new Date() は非決定的です。時刻に依存しないでください(決定性の担保)。',
        },
      ],
      'no-restricted-imports': [
        'error',
        { patterns: ['**/ui/**', '**/sim/**', 'svelte', 'svelte/*'] },
      ],
    },
  },
  {
    // core/ は何にも依存しない。agents/ への依存も禁止する。
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '**/ui/**',
            '**/agents/**',
            '**/sim/**',
            'svelte',
            'svelte/*',
          ],
        },
      ],
    },
  },
  {
    // シミュレーション・スクリプトは Node 環境で実行する(console は許可)。
    // ただし ui/ と svelte への依存は禁止する。
    files: ['src/sim/**/*.ts', 'scripts/**/*.ts', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['**/ui/**', 'svelte', 'svelte/*'] },
      ],
    },
  },
  {
    // ui/ は core/ と agents/ にのみ依存してよい。sim/ への依存は禁止する
    // (docs/architecture.md「依存規則の機械的な強制」/ repository-structure.md「src/ui/」)。
    files: ['src/ui/**/*.ts', 'src/ui/**/*.svelte'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['**/sim/**'] }],
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '.steering/**',
      '.svelte-kit/**',
    ],
  }
);
