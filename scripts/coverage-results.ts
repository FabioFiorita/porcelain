import { isAbsolute, relative, resolve } from 'node:path';
import coverage, { type CoverageMapData } from 'istanbul-lib-coverage';
import { coverageThresholds } from './test-configuration.ts';

export function combineCoverage(root: string, reports: CoverageMapData[]) {
  const merged = coverage.createCoverageMap({});
  for (const report of reports) {
    if (Object.keys(report).length === 0)
      throw new Error('Empty coverage report');
    merged.merge(
      Object.fromEntries(
        Object.entries(report).map(([path, value]) => {
          if (
            isAbsolute(path) ||
            relative(root, resolve(root, path)).startsWith('..')
          )
            throw new Error('Coverage paths must be repository-relative');
          const absolute = resolve(root, path);
          return [absolute, { ...value, path: absolute }];
        }),
      ),
    );
  }
  const summary = merged.getCoverageSummary();
  const failures = Object.entries(coverageThresholds).flatMap(
    ([metric, minimum]) => {
      const actual =
        summary.data[metric as keyof typeof coverageThresholds].pct;
      return typeof actual !== 'number' || actual < minimum
        ? [`Coverage ${metric}: ${actual}% is below ${minimum}%`]
        : [];
    },
  );
  return { merged, failures };
}
