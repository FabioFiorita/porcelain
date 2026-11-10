import { useAtom, useAtomValue } from '@effect/atom-react';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readProjectPullRequests } from '@porcelain/client/reviews';
import { startWalkthrough } from '@porcelain/client/walkthroughs';
import {
  walkthroughPullRequest,
  walkthroughStartFailure,
} from '@porcelain/client/walkthroughs/rules';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { useReviewOverview } from '@/features/changes/index';

export function useStartWalkthrough(
  scope: ReviewScope,
  context: ConnectionContext,
  base: string | undefined,
) {
  const [result, start] = useAtom(
    startWalkthrough({
      connection: context.connection,
      scope: { projectId: scope.projectId, worktreeId: scope.worktreeId },
    }),
    { mode: 'promiseExit' },
  );
  const overview = Option.getOrUndefined(
    AsyncResult.value(useReviewOverview(scope, context.connection)),
  );
  const pulls = useAtomValue(
    readProjectPullRequests({
      connection: context.connection,
      projectId: scope.projectId,
    }),
  );
  const available = AsyncResult.isSuccess(pulls) ? pulls.value : undefined;
  const pullRequestNumber =
    available?.kind === 'available'
      ? walkthroughPullRequest(available.pullRequests, overview?.branch?.name)
      : undefined;
  return {
    waiting: AsyncResult.isWaiting(result),
    failure: AsyncResult.isFailure(result)
      ? walkthroughStartFailure(Cause.squash(result.cause))
      : undefined,
    start: () =>
      void start({
        ...(base === undefined ? {} : { base }),
        ...(pullRequestNumber === undefined ? {} : { pullRequestNumber }),
      }),
  };
}
