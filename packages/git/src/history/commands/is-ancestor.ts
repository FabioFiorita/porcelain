import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { askHistory } from './run-history.ts';

const ancestryExitCodes = { notAncestor: 1, fatal: 128 };
const UNKNOWN_REVISION =
  /(?:not a valid (?:commit name|object name)|unknown revision|bad revision|ambiguous argument)/iu;

export function isHistoryAncestor(
  checkout: string,
  ancestor: string,
  descendant: string,
  limits: GitLimits,
) {
  return askHistory(
    checkout,
    ['merge-base', '--is-ancestor', ancestor, descendant],
    limits,
    (failure) =>
      failure.exitCode === ancestryExitCodes.notAncestor ||
      (failure.exitCode === ancestryExitCodes.fatal &&
        UNKNOWN_REVISION.test(failure.stderr)),
  );
}
