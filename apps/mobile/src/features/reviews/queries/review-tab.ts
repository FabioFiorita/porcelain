import { useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import {
  readLayerMarks,
  readPublishedReview,
  readReviewedFiles,
} from '@porcelain/client/reviews';
import {
  decisionStates,
  walkthroughStops,
  WORKTREE_RANGE,
} from '@porcelain/client/reviews/rules';
import type { Workspace } from '../../projects';
import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import { reviewTab } from '../rules/review-tab';
import { useReviewSnapshot } from './review';
import { reviewFiles } from '../rules/comparison';

export function useReviewTab(
  workspace: Workspace,
  comparison: ReviewComparison,
) {
  const input = { connection: workspace.connection, scope: workspace.scope };
  const review = useAtomValue(readPublishedReview(input));
  const marks = useAtomValue(readLayerMarks(input));
  const files = useAtomValue(
    readReviewedFiles({ ...input, range: WORKTREE_RANGE }),
  );
  const snapshot = useReviewSnapshot(workspace, { kind: 'worktree' }).result;
  const published = AsyncResult.isSuccess(review) ? review.value : undefined;
  return reviewTab(
    published === undefined ? undefined : published !== null,
    published &&
      !review.waiting &&
      AsyncResult.isSuccess(marks) &&
      !marks.waiting &&
      AsyncResult.isSuccess(files) &&
      !files.waiting &&
      AsyncResult.isSuccess(snapshot) &&
      !snapshot.waiting &&
      snapshot.value.kind === 'worktree'
      ? {
          stops: walkthroughStops(
            published,
            snapshot.value.answer.changes.map((file) => file.path),
            { specsApart: true },
          ),
          items: reviewFiles(snapshot.value, files.value),
          decisions: decisionStates(published.layers, marks.value),
        }
      : undefined,
    comparison,
  );
}
