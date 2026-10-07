import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { isOid } from '../../shared/parsers/oid.ts';
import type {
  CommitDiffsRequest,
  HistoryCheckout,
} from '../dtos/commit-history.ts';
import { InvalidHistoryRequestError } from '../../shared/errors/invalid-history-request-error.ts';
import { confirmHistoryCheckout } from './inspect-history-checkout.ts';
import { readCommitPatches } from './read-history-patches.ts';

export const readCommitDiffs = Effect.fn('Git.readHistoryCommitDiffs')(
  function* (
    checkout: HistoryCheckout,
    request: CommitDiffsRequest,
    limits: GitLimits,
  ) {
    const parent = request.parent ?? 1;
    if (
      request.paths.length === 0 ||
      !Number.isInteger(parent) ||
      parent < 1 ||
      !isOid(request.oid)
    )
      return yield* Effect.fail(new InvalidHistoryRequestError());
    yield* confirmHistoryCheckout(checkout);
    const diffs = yield* readCommitPatches(
      checkout.path,
      request.oid,
      parent,
      request.paths,
      limits,
    );
    yield* confirmHistoryCheckout(checkout);
    return diffs;
  },
);
