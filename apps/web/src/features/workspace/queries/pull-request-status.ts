import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import {
  readProjectCheckLog,
  requestedReruns,
  watchProjectPullStatus,
} from '@porcelain/client/projects';
import {
  checkCitations,
  rerunsStillPending,
} from '@porcelain/client/projects/rules';
import { readWalkthrough } from '@porcelain/client/walkthroughs';
import { walkthroughPhase } from '@porcelain/client/walkthroughs/rules';
import { readReviewedFiles } from '@porcelain/client/changes';
import {
  branchReviewRange,
  mergeBranchChanges,
} from '@porcelain/client/changes/rules';
import { useBranchChanges } from '@/features/changes/index';
import type { Connection } from '@/shared/workspace/connection';
import { pageActivity } from '../adapters/page-activity';

export function usePullRequestStatus(
  connection: Connection,
  projectId: string,
  number: number,
) {
  const atom = watchProjectPullStatus({
    connection,
    projectId,
    number,
    activity: pageActivity,
  });
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);
  const watch = Option.getOrUndefined(AsyncResult.value(result));
  const requested = useAtomValue(
    requestedReruns({
      environmentId: connection.environmentId,
      projectId,
      number,
    }),
  );
  const status = watch?.status;
  const pending = [
    ...(watch?.pending ?? []),
    ...(status && result.waiting
      ? rerunsStillPending(status, requested, Date.now()).map(
          (entry) => entry.key,
        )
      : []),
  ];
  return {
    status: watch?.status,
    problem:
      watch?.problem ?? (AsyncResult.isFailure(result) ? 'failed' : undefined),
    reading: result.waiting,
    refresh,
    pendingReruns: new Set(pending),
  };
}

export function useCheckLog(input: {
  connection: Connection;
  projectId: string;
  number: number;
  jobId: number;
  from: string | undefined;
  to: string | undefined;
}) {
  const result = useAtomValue(readProjectCheckLog(input));
  return {
    read: Option.getOrUndefined(AsyncResult.value(result)),
    failed: AsyncResult.isFailure(result),
  };
}

const inactiveWalkthrough = Atom.make(
  AsyncResult.initial<Atom.Success<ReturnType<typeof readWalkthrough>>>(),
);
const inactiveReviewed = Atom.make(
  AsyncResult.initial<Atom.Success<ReturnType<typeof readReviewedFiles>>>(),
);

export function useBranchStanding(
  connection: Connection,
  checkout: { projectId: string; worktreeId: string } | undefined,
) {
  const walkthroughRead = Option.getOrUndefined(
    AsyncResult.value(
      useAtomValue(
        checkout
          ? readWalkthrough({ connection, scope: checkout })
          : inactiveWalkthrough,
      ),
    ),
  );
  const phase = walkthroughRead ? walkthroughPhase(walkthroughRead) : undefined;
  const branch = Option.getOrUndefined(
    AsyncResult.value(useBranchChanges(checkout, connection, undefined).result),
  );
  const marks = Option.getOrUndefined(
    AsyncResult.value(
      useAtomValue(
        checkout && branch?.base
          ? readReviewedFiles({
              connection,
              scope: checkout,
              range: branchReviewRange(branch),
            })
          : inactiveReviewed,
      ),
    ),
  );
  const ready = phase?.kind === 'ready' ? phase : undefined;
  return {
    walkthroughHead: ready?.run.headOid,
    citations: checkCitations(
      (ready?.content.stops ?? []).map((stop, index) => ({
        number: index + 1,
        names: stop.blocks.flatMap((block) =>
          block.kind === 'checks'
            ? block.checks.results.map((result) => result.name)
            : [],
        ),
      })),
    ),
    changedSinceReview:
      branch && marks
        ? mergeBranchChanges(branch.files, marks)
            .filter((item) => item.reviewStatus === 'stale')
            .map((item) => item.path)
        : [],
  };
}
