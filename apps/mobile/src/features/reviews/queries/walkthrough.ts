import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { readReviewMarks } from '@porcelain/client/reviews';
import {
  revisionDecisionStates,
  revisionReviewItems,
  stopDone,
  type ReviewRevision,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import type { Workspace } from '../../projects';

export function useWalkthroughProgress(
  workspace: Workspace,
  revision: ReviewRevision,
  publicationSettled: boolean,
) {
  const query = readReviewMarks({
    connection: workspace.connection,
    reviewId: revision.reviewId,
  });
  const marks = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  const ready = AsyncResult.isSuccess(marks) && !marks.waiting;
  const current = ready ? marks.value : undefined;
  const items = revisionReviewItems(revision, current);
  const states = revisionDecisionStates(revision, current);
  const settled = ready && publicationSettled;
  return {
    revision,
    marks,
    refresh,
    items,
    states,
    settled,
    done: (stop: WalkthroughStop) => settled && stopDone(stop, items, states),
  };
}
