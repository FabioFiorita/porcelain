import { readRangeDiffs } from '../../inspection/index.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { isOid } from '../../shared/parsers/oid.ts';
import type { BranchDiffs, BranchDiffsRequest } from '../dtos/branch-range.ts';
import type { HistoryCheckout } from '../dtos/commit-history.ts';
import { InvalidHistoryRequestError } from '../../shared/errors/invalid-history-request-error.ts';
import { confirmHistoryCheckout } from './inspect-history-checkout.ts';
import { readHistoryAnswer } from './run-history.ts';

const ABSENT = 1;

export async function readBranchDiffs(
  checkout: HistoryCheckout,
  request: BranchDiffsRequest,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<BranchDiffs> {
  if (
    request.paths.length === 0 ||
    !isOid(request.baseOid) ||
    !isOid(request.headOid)
  )
    throw new InvalidHistoryRequestError();
  await confirmHistoryCheckout(checkout, signal);
  for (const oid of [request.baseOid, request.headOid]) {
    const commit = await readHistoryAnswer(
      checkout.path,
      ['rev-parse', '--verify', '--quiet', `${oid}^{commit}`],
      limits,
      signal,
      (failure) => failure.exitCode === ABSENT,
    );
    if (commit === null) return { kind: 'missing' };
  }
  const sections = await readRangeDiffs(
    checkout.path,
    request.baseOid,
    request.headOid,
    request.paths,
    limits,
    signal,
  );
  await confirmHistoryCheckout(checkout, signal);
  return { kind: 'read', sections };
}
