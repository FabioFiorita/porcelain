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
  '@porcelain/server',
  ...packages.filter(decides).map((name) => `@porcelain/${name}`),
];

function problems(modules: ReadonlyArray<TestModule>): string[] {
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
    if (!ran.has(name))
      found.push(
        `${name} ran no spec; a package that decides keeps its specs.`,
      );
  return found;
}

const specDiscipline: Reporter = {
  onTestRunEnd(modules) {
    const found = problems(modules);
    for (const problem of found) process.stderr.write(`${problem}\n`);
    if (found.length > 0) process.exitCode = 1;
  },
};

export default defineConfig({
  test: {
    root,
    passWithNoTests: false,
    allowOnly: false,
    reporters: ['default', specDiscipline],
    projects: [
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
