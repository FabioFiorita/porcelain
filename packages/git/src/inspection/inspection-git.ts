import type { GitBranchDetails } from './dtos/git-status.ts';
import { Effect } from 'effect';
import { readStatus } from './commands/read-status.ts';
import { readInProgress } from './commands/read-in-progress.ts';
import { readBranchTracking } from './commands/read-branch-tracking.ts';
import { readStashes } from './commands/read-stashes.ts';
import { readHeadCommit } from './commands/read-head-commit.ts';
import { readUpstreamOid } from './commands/read-upstream-oid.ts';
import { readDiscarded } from './commands/read-discarded.ts';
import type { EffectCheckoutSession } from './interfaces/git-session.ts';
import type { GitLimits } from '../shared/dtos/git-limits.ts';

export const readCheckoutStatus = Effect.fn('Git.readCheckoutStatus')(
  function* (checkout: EffectCheckoutSession, limits: GitLimits) {
    yield* checkout.verify();
    const [status, operation] = yield* Effect.all(
      [readStatus(checkout, limits), readInProgress(checkout.path)],
      { concurrency: 'unbounded' },
    );
    return { ...status, ...operation };
  },
);

export const readBranchDetails = Effect.fn('Git.readBranchDetails')(function* (
  checkout: EffectCheckoutSession,
  branch: string | null,
  headOid: string | null,
  limits: GitLimits,
) {
  yield* checkout.verify();
  const tracking = branch
    ? yield* readBranchTracking(checkout.path, branch, limits)
    : undefined;
  const stashes = yield* readStashes(checkout.path, limits);
  const headCommit = headOid
    ? yield* readHeadCommit(checkout.path, headOid, limits)
    : null;
  const upstreamOid =
    tracking?.remoteName && tracking.upstream
      ? yield* readUpstreamOid(checkout.path, tracking.upstream, limits)
      : null;
  return {
    remoteName: tracking?.remoteName ?? null,
    sourceRef: tracking?.sourceRef ?? null,
    upstreamOid,
    stashes,
    discarded: yield* readDiscarded(checkout.path, limits),
    headCommit,
  } satisfies GitBranchDetails;
});
