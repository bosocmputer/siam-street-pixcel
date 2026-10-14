import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/out/**',
      'demo/**',
      'docs/**',
      'tools/asset-pipeline/raw/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // game-core must stay deterministic: use the injected rng / server time instead
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded rng from game-core.' },
        { object: 'Date', property: 'now', message: 'Use server time passed in as a parameter.' },
      ],
    },
  },
  {
    files: ['apps/**', 'tools/**', '**/*.test.ts', '**/*.config.*', 'packages/game-core/test/**'],
    rules: { 'no-restricted-properties': 'off' },
  },
);
