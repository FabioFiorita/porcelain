import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CoverageMapData } from 'istanbul-lib-coverage';
import reporting from 'istanbul-lib-report';
import reports from 'istanbul-reports';
import { combineCoverage } from './coverage-results.ts';
import { repositoryRoot, testScopes } from './test-configuration.ts';

const data = Object.values(testScopes).map(
  (scope) =>
    JSON.parse(
      readFileSync(
        resolve(repositoryRoot, scope.output, 'coverage-final.json'),
        'utf8',
      ),
    ) as CoverageMapData,
);
const { merged, failures } = combineCoverage(repositoryRoot, data);
const context = reporting.createContext({
  dir: resolve(repositoryRoot, 'coverage/combined'),
  coverageMap: merged,
});
for (const reporter of ['text', 'json-summary', 'lcov', 'html'] as const)
  reports.create(reporter).execute(context);
for (const failure of failures) console.error(failure);
if (failures.length) process.exitCode = 1;
