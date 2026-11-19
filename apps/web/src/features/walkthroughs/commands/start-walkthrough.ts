import { useAtom } from '@effect/atom-react';
import { Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import { readProjectPullRequests } from '@porcelain/client/projects';
import {
  startWalkthrough,
  walkthroughStartBinding,
} from '@porcelain/client/walkthroughs';
import type { WalkthroughRun } from '@porcelain/client/walkthroughs/rules';
import type { ReviewScope } from '@porcelain/client/changes/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { useReviewOverview } from '@/features/changes/index';
import { useMountedRead } from '@/shared/query/mounted-read';

const inactivePulls = Atom.make(
  AsyncResult.initial<
    Atom.Success<ReturnType<typeof readProjectPullRequests>>,
    Atom.Failure<ReturnType<typeof readProjectPullRequests>>
  >(),
);

export function useStartWalkthrough(
  scope: ReviewScope,
  context: ConnectionContext,
  base: string | undefined,
  displayedRun: WalkthroughRun | undefined,
  hidden: boolean,
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
  const pulls =
    useMountedRead(
      hidden
        ? inactivePulls
        : readProjectPullRequests({
            connection: context.connection,
            projectId: scope.projectId,
          }),
    ) ?? AsyncResult.initial();
  return walkthroughStartBinding([result, start], {
    pulls,
    branch: overview?.branch?.name ?? displayedRun?.branch,
    displayedRun,
    base,
  });
}
