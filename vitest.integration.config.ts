import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: import.meta.dirname,
    maxWorkers: process.env.CI ? 2 : 1,
    passWithNoTests: false,
    allowOnly: false,
    projects: [
      {
        test: {
          name: '@porcelain/server-integration',
          root: import.meta.dirname,
          include: [
            'apps/server/spec/integration/*.integration.ts',
            '.agents/skills/spec/integration/*.integration.ts',
          ],
          globalSetup: ['apps/server/spec/kit/global-setup.ts'],
          expect: { requireAssertions: true },
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
      {
        test: {
          name: '@porcelain/server-perf',
          root: import.meta.dirname,
          include: ['apps/server/spec/perf/*.perf.ts'],
          globalSetup: ['apps/server/spec/kit/global-setup.ts'],
          expect: { requireAssertions: true },
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
      {
        test: {
          name: '@porcelain/client-integration',
          root: import.meta.dirname,
          include: ['packages/client/spec/integration/*.integration.ts'],
          globalSetup: ['packages/client/spec/kit/global-setup.ts'],
          expect: { requireAssertions: true },
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
