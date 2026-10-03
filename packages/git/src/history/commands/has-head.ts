import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { askHistory } from './run-history.ts';

const MISSING = 1;

export function hasHead(
  checkout: string,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<boolean> {
  return askHistory(
    checkout,
    ['rev-parse', '--verify', '--quiet', 'HEAD'],
    limits,
    signal,
    (failure) => failure.exitCode === MISSING,
  );
}
