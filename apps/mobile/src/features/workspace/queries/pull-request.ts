import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import {
  readProjectCheckLog,
  readProjectPullRequest,
  watchProjectPullStatus,
  watchPullStatusView,
  type PageActivity,
} from '@porcelain/client/projects';
import {
  pullRequestBlockers,
  pullRequestCheckout,
  pullRequestMergeBlock,
  undecidedCallAtHead,
  withPullRequestStatus,
} from '@porcelain/client/projects/rules';
import {
  readWalkthrough,
  readWalkthroughMergeReview,
} from '@porcelain/client/walkthroughs';
import { walkthroughPhase } from '@porcelain/client/walkthroughs/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { useWritesBlocked } from '../../access';
import { useInventory } from '../../projects/index';

export type PullRequestRef = {
  readonly connection: RuntimeConnection;
  readonly projectId: string;
  readonly number: number;
};

export function usePullRequestRead(target: PullRequestRef) {
  const query = readProjectPullRequest(target);
  const result = useAtomValue(query);
  return { result, refresh: useAtomRefresh(query) };
}

export function usePullRequestStatus(
  target: PullRequestRef,
  activity: PageActivity,
) {
  const input = { ...target, activity };
  return {
    ...useAtomValue(watchPullStatusView(input)),
    refresh: useAtomRefresh(watchProjectPullStatus(input)),
  };
}

export function useCheckLog(
  input: PullRequestRef & {
    jobId: number;
    from: string | undefined;
    to: string | undefined;
  },
) {
  const atom = readProjectCheckLog(input);
  const result = useAtomValue(atom);
  return {
    read: Option.getOrUndefined(AsyncResult.value(result)),
    failed: AsyncResult.isFailure(result),
    retry: useAtomRefresh(atom),
  };
}

const inactiveWalkthrough = Atom.make(
  AsyncResult.initial<Atom.Success<ReturnType<typeof readWalkthrough>>>(),
);

type AvailablePull = Extract<
  Atom.Success<ReturnType<typeof readProjectPullRequest>>,
  { kind: 'available' }
>['pullRequest'];

export function usePullRequestMerge(
  target: PullRequestRef,
  pull: AvailablePull,
  activity: PageActivity,
) {
  const live = usePullRequestStatus(target, activity);
  const inventory = Option.getOrUndefined(
    AsyncResult.value(useInventory(target.connection).result),
  );
  const checkout = pullRequestCheckout(
    inventory?.projects ?? [],
    target.projectId,
    pull.headBranch,
  );
  const walkthroughRead = Option.getOrUndefined(
    AsyncResult.value(
      useAtomValue(
        checkout
          ? readWalkthrough({ connection: target.connection, scope: checkout })
          : inactiveWalkthrough,
      ),
    ),
  );
  const phase = walkthroughRead ? walkthroughPhase(walkthroughRead) : undefined;
  const ready = phase?.kind === 'ready' ? phase : undefined;
  const review = useAtomValue(
    readWalkthroughMergeReview(
      checkout && ready
        ? {
            connection: target.connection,
            scope: checkout,
            runId: ready.run.id,
            headOid: ready.run.headOid,
            content: ready.content,
          }
        : undefined,
    ),
  );
  const offline = useWritesBlocked(target.connection.environmentId);
  const merged = withPullRequestStatus(pull, live.status);
  return {
    ...live,
    pull: merged,
    checkout,
    walkthroughHead: ready?.run.headOid,
    review,
    blockers: live.status
      ? pullRequestBlockers(live.status, merged.baseBranch)
      : [],
    undecidedCall: undecidedCallAtHead(review, merged.headSha),
    block: offline
      ? 'The computer is offline.'
      : pullRequestMergeBlock(merged, review),
    blockShown:
      live.status === undefined ||
      review?.undecidedCallStep === 'reading' ||
      review?.undecidedCallStep === 'unreadable',
  };
}
