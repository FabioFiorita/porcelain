import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { askHistory } from './run-history.ts';

const MISSING = 1;

export function hasHead(checkout: string, limits: GitLimits) {
  return askHistory(
    checkout,
    ['rev-parse', '--verify', '--quiet', 'HEAD'],
    limits,
    (failure) => failure.exitCode === MISSING,
  );
}
