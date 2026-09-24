import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { runInspection } from './run-inspection.ts';

export async function listIgnoredPaths(
  checkout: string,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<string[]> {
  const output = await runInspection(
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
    signal,
    { maxBytes: limits.inspection.ignoredPathsBytes },
  );
  return output
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((path) => (path.endsWith('/') ? path.slice(0, -1) : path));
}
