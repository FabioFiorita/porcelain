import { Effect } from 'effect';
import { readRangePatches } from './read-history-patches.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { isOid } from '../../shared/parsers/oid.ts';
import type { BranchDiffs, BranchDiffsRequest } from '../dtos/branch-range.ts';
import type { HistoryCheckout } from '../dtos/commit-history.ts';
import { InvalidHistoryRequestError } from '../../shared/errors/invalid-history-request-error.ts';
import { confirmHistoryCheckout } from './inspect-history-checkout.ts';
import { readHistoryAnswer } from './run-history.ts';

const ABSENT = 1;

export const readBranchDiffs = Effect.fn('Git.readBranchDiffs')(function* (
  checkout: HistoryCheckout,
  request: BranchDiffsRequest,
  limits: GitLimits,
) {
  if (
    request.paths.length === 0 ||
    !isOid(request.baseOid) ||
    !isOid(request.headOid)
  )
    return yield* Effect.fail(new InvalidHistoryRequestError());
  yield* confirmHistoryCheckout(checkout);
  for (const oid of [request.baseOid, request.headOid]) {
    const commit = yield* readHistoryAnswer(
      checkout.path,
      ['rev-parse', '--verify', '--quiet', `${oid}^{commit}`],
      limits,
      (failure) => failure.exitCode === ABSENT,
    );
    if (commit === null) return { kind: 'missing' } satisfies BranchDiffs;
  }
  const sections = yield* readRangePatches(
    checkout.path,
    request.baseOid,
    request.headOid,
    request.paths,
    limits,
  );
  yield* confirmHistoryCheckout(checkout);
  return { kind: 'read', sections } satisfies BranchDiffs;
});
