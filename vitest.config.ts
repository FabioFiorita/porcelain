import { defineConfig, mergeConfig } from 'vitest/config';
import { webTestConfiguration } from './apps/web/vitest.config.ts';

export default mergeConfig(
  webTestConfiguration,
  defineConfig({
    test: {
      pool: 'forks',
      include: [
        'scripts/**/*.spec.ts',
        'packages/*/src/**/*.spec.ts',
        'apps/server/src/**/*.spec.ts',
        'apps/web/src/**/*.spec.ts',
        'apps/web/src/**/*.spec.tsx',
      ],
      passWithNoTests: false,
      reporters: ['default', 'junit'],
      outputFile: { junit: 'coverage/junit.xml' },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json-summary', 'lcov', 'html'],
        reportsDirectory: 'coverage',
        thresholds: { statements: 90, branches: 80, functions: 85, lines: 90 },
        include: [
          'apps/web/development/**/*.ts',
          'scripts/**/*.ts',
          'packages/*/src/**/*.ts',
          'apps/server/src/**/*.ts',
          'apps/web/src/domain/**/*.ts',
          'apps/web/src/api/**/*.ts',
          'apps/web/src/query/**/*.{ts,tsx}',
          'apps/web/src/lib/**/*.ts',
          'apps/web/src/views/**/*.tsx',
        ],
        exclude: [
          '**/*.spec.ts',
          '**/*.spec.tsx',
          'apps/web/src/api/boot.ts',
          'apps/web/src/api/mock-api.ts',
          'apps/web/src/api/playground-credentials.ts',
          'apps/web/src/query/playground.ts',
          'apps/web/src/lib/utils.ts',
          'scripts/check-boundaries.ts',
        ],
      },
    },
  }),
);
