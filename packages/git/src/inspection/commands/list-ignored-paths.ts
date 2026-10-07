import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { runInspection } from './run-inspection.ts';

export const listIgnoredPaths = Effect.fn('Git.listIgnoredPaths')(function* (
  checkout: string,
  limits: GitLimits,
) {
  const output = yield* runInspection(
    checkout,
    [
      'ls-files',
      '-z',
      '--others',
      '--ignored',
      '--exclude-standard',
      '--directory',
    ],
    limits,
    { maxBytes: limits.inspection.ignoredPathsBytes },
  );
  return output
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((path) => (path.endsWith('/') ? path.slice(0, -1) : path));
});
