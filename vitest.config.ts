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
    reporters: ['default', 'junit'],
    outputFile: { junit: 'coverage/junit.xml' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov', 'html'],
      thresholds: { statements: 90, branches: 80, functions: 85, lines: 90 },
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
