import { useAtom, useAtomValue } from '@effect/atom-react';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readProjectPullRequests } from '@porcelain/client/reviews';
import { startWalkthrough } from '@porcelain/client/walkthroughs';
import {
  walkthroughPullRequest,
  walkthroughStartFailure,
} from '@porcelain/client/walkthroughs/rules';
import type { Workspace } from '../../projects/index';
import { walkthroughSelection } from '../queries/walkthrough';

export function useStartWalkthrough(workspace: Workspace) {
  const [result, start] = useAtom(
    startWalkthrough(walkthroughSelection(workspace)),
    { mode: 'promiseExit' },
  );
  const pulls = useAtomValue(
    readProjectPullRequests({
      connection: workspace.connection,
      projectId: workspace.scope.projectId,
    }),
  );
  const available = AsyncResult.isSuccess(pulls) ? pulls.value : undefined;
  const pullRequestNumber =
    available?.kind === 'available'
      ? walkthroughPullRequest(
          available.pullRequests,
          workspace.worktree.branch ?? undefined,
        )
      : undefined;
  return {
    waiting: AsyncResult.isWaiting(result),
    failure: AsyncResult.isFailure(result)
      ? walkthroughStartFailure(Cause.squash(result.cause))
      : undefined,
    start: () =>
      void start(pullRequestNumber === undefined ? {} : { pullRequestNumber }),
  };
}
