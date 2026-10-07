import { Effect } from 'effect';
import { UnsupportedPathEncodingError } from '../../shared/errors/unsupported-path-encoding-error.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { runInspection } from './run-inspection.ts';

export const listTrackedPaths = Effect.fn('Git.listTrackedPaths')(function* (
  checkout: string,
  limits: GitLimits,
) {
  const output = yield* runInspection(
    checkout,
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    limits,
    { maxBytes: limits.inspection.trackedPathsBytes },
  );
  const decoded = yield* Effect.try({
    try: () =>
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(output),
    catch: (cause) => new UnsupportedPathEncodingError({ cause }),
  });
  const paths = decoded.split('\0').filter(Boolean);
  return paths.length > limits.inspection.maxTrackedPaths
    ? { paths: [], complete: false }
    : { paths: paths.sort(), complete: true };
});
