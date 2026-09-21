import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import { webTestConfiguration } from './apps/web/vitest.config.ts';

// macOS's default temporary path is both symlinked and too long for nested
// owner sockets. Fixtures need a short, canonical root on both supported OSes.
process.env.TMPDIR = realpathSync(
  process.platform === 'darwin' ? '/tmp' : tmpdir(),
);

const coverage = {
  provider: 'istanbul' as const,
  reporter: ['text', 'json-summary', 'lcov', 'html'],
  reportsDirectory: 'coverage',
  thresholds: { statements: 80, branches: 70, functions: 80, lines: 80 },
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
    'apps/web/src/api/pairing/playground.ts',
    'apps/web/src/query/playground.ts',
    'apps/web/src/lib/utils.ts',
    'scripts/check-boundaries.ts',
  ],
};

export default defineConfig({
  test: {
    passWithNoTests: false,
    reporters: ['default', 'junit'],
    outputFile: { junit: 'coverage/junit.xml' },
    coverage,
    projects: [
      mergeConfig(
        webTestConfiguration,
        defineConfig({
          test: {
            name: 'node',
            pool: 'forks',
            include: [
              'scripts/**/*.spec.ts',
              'packages/*/src/**/*.spec.ts',
              'apps/server/src/**/*.spec.ts',
              'apps/web/src/**/*.spec.ts',
            ],
            exclude: [
              ...configDefaults.exclude,
              'apps/web/src/domain/html-assets.spec.ts',
            ],
          },
        }),
      ),
      './apps/web/vitest.config.ts',
    ],
  },
});
