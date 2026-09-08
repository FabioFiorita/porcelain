import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { CoverageMapData } from 'istanbul-lib-coverage';
import { repositoryRoot, testScopes } from './test-configuration.ts';

const scope = process.argv[2];
if (!scope || !(scope in testScopes))
  throw new Error('Expected contracts, git, server or tooling test scope');
const result = spawnSync(
  'vitest',
  [
    'run',
    '--coverage',
    '--config',
    resolve(repositoryRoot, 'vitest.config.ts'),
  ],
  {
    cwd: repositoryRoot,
    stdio: 'inherit',
    env: { ...process.env, PORCELAIN_TEST_SCOPE: scope },
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
// Cached coverage must work in a different CI checkout path.
const report = resolve(
  repositoryRoot,
  testScopes[scope as keyof typeof testScopes].output,
  'coverage-final.json',
);
const data = JSON.parse(readFileSync(report, 'utf8')) as CoverageMapData;
const normalized = Object.fromEntries(
  Object.entries(data).map(([path, value]) => {
    const source = relative(repositoryRoot, path);
    return [source, { ...value, path: source }];
  }),
);
writeFileSync(report, JSON.stringify(normalized));
