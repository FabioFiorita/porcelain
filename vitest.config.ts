import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import type { Reporter } from 'vitest/node';

const root = dirname(fileURLToPath(import.meta.url));
const packages = readdirSync(join(root, 'packages'), { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      entry.name !== 'theme' &&
      existsSync(join(root, 'packages', entry.name, 'src')),
  )
  .map((entry) => entry.name);

function isolatedGit(name: string): string {
  return `packages/${name}/spec/fixtures/isolated-git.ts`;
}

const typeOnlyFolders = new Set(['models', 'ports', 'errors']);

function decides(name: string): boolean {
  return readdirSync(join(root, 'packages', name, 'src'), {
    withFileTypes: true,
  }).some((entry) => !entry.isDirectory() || !typeOnlyFolders.has(entry.name));
}

const required = [
  '@porcelain/mobile',
  '@porcelain/desktop',
  '@porcelain/server',
  ...packages.filter(decides).map((name) => `@porcelain/${name}`),
];

const mobileE2e = {
  globalSetup: ['apps/mobile/spec/e2e/global-setup.ts'],
  expect: { requireAssertions: true },
  fileParallelism: false,
  testTimeout: 15 * 60_000,
  hookTimeout: 20 * 60_000,
};

function specDiscipline(): Reporter {
  let selected: string[] = [];
  return {
    onInit(vitest) {
      selected = vitest.projects
        .map((project) => project.name)
        .filter((name) => required.includes(name));
    },
    onTestRunEnd(modules) {
      const ran = new Set(
        modules
          .filter((module) =>
            [...module.children.allTests()].some((test) =>
              ['passed', 'failed'].includes(test.result().state),
            ),
          )
          .map((module) => module.project.name),
      );
      for (const name of selected)
        if (!ran.has(name)) {
          process.stderr.write(`${name} ran 0 tests.\n`);
          process.exitCode = 1;
        }
    },
  };
}

export default defineConfig({
  test: {
    root,
    maxWorkers: process.env.CI ? 2 : 1,
    passWithNoTests: false,
    allowOnly: false,
    reporters: ['default', specDiscipline()],
    projects: [
      {
        test: {
          name: '@porcelain/mobile',
          root,
          include: [
            'apps/mobile/src/**/*.spec.ts',
            'apps/mobile/spec/**/*.spec.ts',
          ],
          expect: { requireAssertions: true },
        },
      },
      {
        test: {
          name: '@porcelain/mobile-e2e',
          root,
          include: ['apps/mobile/spec/e2e/*.e2e.ts'],
          exclude: ['apps/mobile/spec/e2e/*.tablet.e2e.ts'],
          ...mobileE2e,
        },
      },
      {
        test: {
          name: '@porcelain/mobile-e2e-tablet',
          root,
          include: [
            'apps/mobile/spec/e2e/*.tablet.e2e.ts',
            'apps/mobile/spec/e2e/pairing.e2e.ts',
          ],
          ...mobileE2e,
        },
      },
      {
        test: {
          name: '@porcelain/desktop',
          root,
          include: ['apps/desktop/src/**/*.spec.ts'],
          expect: { requireAssertions: true },
        },
      },
      {
        test: {
          name: '@porcelain/server',
          root,
          include: [
            'apps/server/src/**/*.spec.ts',
            'apps/server/spec/**/*.spec.ts',
          ],
          expect: { requireAssertions: true },
        },
      },
      {
        test: {
          name: '@porcelain/server-integration',
          root,
          include: ['apps/server/spec/integration/*.integration.ts'],
          globalSetup: ['apps/server/spec/kit/global-setup.ts'],
          expect: { requireAssertions: true },
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
      {
        test: {
          name: '@porcelain/server-perf',
          root,
          include: ['apps/server/spec/perf/*.perf.ts'],
          globalSetup: ['apps/server/spec/kit/global-setup.ts'],
          expect: { requireAssertions: true },
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
      {
        resolve: { alias: { '@': join(root, 'apps/web/src') } },
        test: {
          name: '@porcelain/web',
          root,
          include: ['apps/web/src/features/*/rules/*.spec.ts'],
          expect: { requireAssertions: true },
        },
      },
      {
        test: {
          name: '@porcelain/client-integration',
          root,
          include: ['packages/client/spec/integration/*.integration.ts'],
          globalSetup: ['packages/client/spec/kit/global-setup.ts'],
          expect: { requireAssertions: true },
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
      ...packages.map((name) => ({
        test: {
          name: `@porcelain/${name}`,
          root,
          include: [
            `packages/${name}/src/**/*.spec.ts`,
            `packages/${name}/spec/**/*.spec.ts`,
          ],
          expect: { requireAssertions: true },
          setupFiles: existsSync(join(root, isolatedGit(name)))
            ? [isolatedGit(name)]
            : [],
        },
      })),
    ],
  },
});
