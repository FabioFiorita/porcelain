import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { askHistory } from './run-history.ts';

const ancestryExitCodes = { notAncestor: 1, fatal: 128 };
const UNKNOWN_REVISION =
  /(?:not a valid (?:commit name|object name)|unknown revision|bad revision|ambiguous argument)/iu;

export function isAncestorOfHead(
  checkout: string,
  tip: string,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<boolean> {
  return askHistory(
    checkout,
    ['merge-base', '--is-ancestor', tip, 'HEAD'],
    limits,
    signal,
    (failure) =>
      failure.exitCode === ancestryExitCodes.notAncestor ||
      (failure.exitCode === ancestryExitCodes.fatal &&
        UNKNOWN_REVISION.test(failure.stderr)),
  );
}
