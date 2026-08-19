import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'prisma/migrations/**',
    ],
  },
  js.configs.recommended,
  {
    // .mjs is Node script scope too (backend/scripts/*.mjs) - widened from
    // '**/*.js' alone, which left process/console/Buffer/setTimeout/fetch/
    // FormData/Blob reporting as no-undef in every .mjs file (they were
    // falling through to js.configs.recommended above with no Node
    // globals at all). globals.node (the same set already used here)
    // already defines all of those - confirmed directly against this
    // project's installed globals package - so no extra entries are added.
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-duplicate-imports': 'error',
      'no-fallthrough': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
      'no-useless-catch': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
    },
  },
  {
    files: ['src/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {},
  },
];
