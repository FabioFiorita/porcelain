import { useAtom, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readProjectPullRequests } from '@porcelain/client/projects';
import {
  startWalkthrough,
  walkthroughStartBinding,
} from '@porcelain/client/walkthroughs';
import type { WalkthroughRun } from '@porcelain/client/walkthroughs/rules';
import type { ReviewScope } from '@porcelain/client/changes/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { useReviewOverview } from '@/features/changes/index';

export function useStartWalkthrough(
  scope: ReviewScope,
  context: ConnectionContext,
  base: string | undefined,
  displayedRun: WalkthroughRun | undefined,
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
  return walkthroughStartBinding([result, start], {
    pulls,
    branch: overview?.branch?.name,
    displayedRun,
    base,
  });
}
