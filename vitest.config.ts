import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    include: [
      'scripts/**/*.spec.ts',
      'packages/*/src/**/*.spec.ts',
      'apps/server/src/**/*.spec.ts',
    ],
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: [
        'scripts/**/*.ts',
        'packages/*/src/**/*.ts',
        'apps/server/src/**/*.ts',
      ],
      exclude: [
        '**/*.spec.ts',
        'scripts/check-boundaries.ts',
        'scripts/check-conventions.ts',
      ],
    },
  },
});
