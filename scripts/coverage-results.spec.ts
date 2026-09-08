import type { CoverageMapData } from 'istanbul-lib-coverage';
import { expect, it } from 'vitest';
import { combineCoverage } from './coverage-results.ts';

function report(path: string, first: number, second: number): CoverageMapData {
  return {
    [path]: {
      path,
      statementMap: {
        '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
        '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
      },
      s: { '0': first, '1': second },
      fnMap: {},
      f: {},
      branchMap: {},
      b: {},
    },
  };
}
it('combines cached and fresh execution coverage without averaging percentages or double-counting files', () => {
  const result = combineCoverage('/checkout', [
    report('packages/git/src/git.ts', 1, 0),
    report('packages/git/src/git.ts', 0, 1),
  ]);
  expect(result.failures).toEqual([]);
  expect(result.merged.files()).toEqual(['/checkout/packages/git/src/git.ts']);
  expect(result.merged.getCoverageSummary().statements).toMatchObject({
    total: 2,
    covered: 2,
    pct: 100,
  });
});
it('rejects insufficient combined coverage and empty or nonportable cache reports', () => {
  expect(
    combineCoverage('/checkout', [report('apps/server/src/app.ts', 1, 0)])
      .failures,
  ).toContain('Coverage statements: 50% is below 90%');
  expect(() => combineCoverage('/checkout', [{}])).toThrow(
    'Empty coverage report',
  );
  expect(() =>
    combineCoverage('/checkout', [report('/old-checkout/app.ts', 1, 1)]),
  ).toThrow('repository-relative');
  expect(() =>
    combineCoverage('/checkout', [report('../app.ts', 1, 1)]),
  ).toThrow('repository-relative');
});
