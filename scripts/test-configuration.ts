import { matchesGlob, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
export const coverageThresholds = {
  statements: 90,
  branches: 80,
  functions: 85,
  lines: 90,
};
export const testScopes = {
  contracts: {
    tests: ['packages/contracts/src/**/*.spec.ts'],
    sources: ['packages/contracts/src/**/*.ts'],
    output: 'packages/contracts/coverage',
  },
  git: {
    tests: ['packages/git/src/**/*.spec.ts'],
    sources: ['packages/git/src/**/*.ts'],
    output: 'packages/git/coverage',
  },
  server: {
    tests: ['apps/server/src/**/*.spec.ts'],
    sources: [
      'apps/server/src/**/*.ts',
      'packages/git/src/**/*.ts',
      'packages/contracts/src/**/*.ts',
    ],
    output: 'apps/server/coverage',
  },
  tooling: {
    tests: ['scripts/**/*.spec.ts'],
    sources: ['scripts/**/*.ts'],
    output: 'coverage/tooling',
  },
};
export function testConfiguration(scope?: string) {
  if (scope !== undefined && !(scope in testScopes))
    throw new Error(`Unknown test scope: ${scope}`);
  const selected =
    scope === undefined
      ? undefined
      : testScopes[scope as keyof typeof testScopes];
  const output = resolve(repositoryRoot, selected?.output ?? 'coverage');
  return defineConfig({
    root: repositoryRoot,
    test: {
      pool: 'forks',
      include: selected?.tests ?? [
        'scripts/**/*.spec.ts',
        'packages/*/src/**/*.spec.ts',
        'apps/server/src/**/*.spec.ts',
      ],
      passWithNoTests: false,
      reporters: ['default', 'junit'],
      outputFile: { junit: `${output}/junit.xml` },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'json-summary', 'lcov', 'html'],
        reportsDirectory: output,
        ...(selected ? {} : { thresholds: coverageThresholds }),
        include: selected?.sources ?? [
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
}

// Built-app browser smoke tests run through Playwright, outside Vitest coverage tasks.
const browserSmokeTests = ['apps/web/e2e/**/*.spec.ts'];

export function assertTestOwnership(paths: string[]): void {
  for (const path of paths) {
    const owners = Object.values(testScopes).filter((scope) =>
      scope.tests.some((pattern) => matchesGlob(path, pattern)),
    );
    const browserOwner = browserSmokeTests.some((pattern) =>
      matchesGlob(path, pattern),
    );
    if (owners.length + Number(browserOwner) !== 1)
      throw new Error(
        `Expected one test scope for ${path}; found ${owners.length + Number(browserOwner)}`,
      );
  }
}
