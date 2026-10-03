import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import type { Reporter, TestModule } from 'vitest/node';

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

function problems(
  modules: ReadonlyArray<TestModule>,
  selected: ReadonlySet<string>,
): string[] {
  const found: string[] = [];
  const ran = new Set<string>();
  for (const module of modules) {
    ran.add(module.project.name);
    for (const test of module.children.allTests()) {
      const { mode, fails } = test.options;
      if (test.result().state === 'skipped' || mode !== 'run' || fails)
        found.push(
          `${module.moduleId}: "${test.fullName}" does not run as a plain case; every spec runs every time.`,
        );
    }
  }
  for (const name of required)
    if (selected.has(name) && !ran.has(name))
      found.push(
        `${name} ran no spec; a package that decides keeps its specs.`,
      );
  return found;
}

const mobileE2e = {
  globalSetup: ['apps/mobile/spec/e2e/global-setup.ts'],
  expect: { requireAssertions: true },
  fileParallelism: false,
  testTimeout: 15 * 60_000,
  hookTimeout: 20 * 60_000,
};

function specDiscipline(): Reporter {
  let selected: ReadonlySet<string> = new Set(required);
  return {
    onInit(vitest) {
      selected = new Set(vitest.projects.map((project) => project.name));
    },
    onTestRunEnd(modules) {
      const found = problems(modules, selected);
      for (const problem of found) process.stderr.write(`${problem}\n`);
      if (found.length > 0) process.exitCode = 1;
    },
  };
}

export default defineConfig({
  test: {
    root,
    maxWorkers: '25%',
    passWithNoTests: false,
    allowOnly: false,
    reporters: ['default', specDiscipline()],
    projects: [
      {
        test: {
          name: '@porcelain/mobile',
          root,
          include: ['apps/mobile/src/**/*.spec.ts'],
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
