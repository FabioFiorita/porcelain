import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import {
  assertTestOwnership,
  repositoryRoot,
  testConfiguration,
} from './test-configuration.ts';

it('assigns every current spec to exactly one cached test scope', () => {
  const specs = execFileSync(
    'git',
    [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '-z',
      '--',
      'scripts',
      'apps',
      'packages',
    ],
    { cwd: repositoryRoot, encoding: 'utf8' },
  )
    .split('\0')
    .filter(
      (path) =>
        /\.spec\.[cm]?[jt]sx?$/.test(path) &&
        existsSync(resolve(repositoryRoot, path)),
    );
  expect(specs.length).toBeGreaterThan(0);
  expect(() => assertTestOwnership(specs)).not.toThrow();
});
it('keeps standalone verification thresholds and rejects unknown scoped selections', () => {
  expect(testConfiguration().test?.coverage).toMatchObject({
    thresholds: { statements: 90, branches: 80, functions: 85, lines: 90 },
  });
  expect(testConfiguration('git').test).toMatchObject({
    include: ['packages/git/src/**/*.spec.ts'],
    passWithNoTests: false,
  });
  expect(() => testConfiguration('missing')).toThrow('Unknown test scope');
});

it('rejects a newly introduced renderer spec without an owning test task', () => {
  expect(() => assertTestOwnership(['apps/web/src/view.spec.tsx'])).toThrow(
    'Expected one test scope',
  );
});
