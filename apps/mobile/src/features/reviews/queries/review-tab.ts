import { useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { readLayerMarks, readPublishedReview } from '@porcelain/client/reviews';
import { decisionStates } from '@porcelain/client/reviews/rules';
import type { Workspace } from '../../projects';
import { reviewTab } from '../rules/review-tab';

export function useReviewTab(workspace: Workspace) {
  const input = { connection: workspace.connection, scope: workspace.scope };
  const review = useAtomValue(readPublishedReview(input));
  const marks = useAtomValue(readLayerMarks(input));
  const published = AsyncResult.isSuccess(review) ? review.value : undefined;
  return reviewTab(
    published === undefined ? undefined : published !== null,
    published && AsyncResult.isSuccess(marks)
      ? [...decisionStates(published.layers, marks.value).values()]
      : undefined,
  );
}
