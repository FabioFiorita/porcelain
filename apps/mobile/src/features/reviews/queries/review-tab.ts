import { useAtomValue } from '@effect/atom-react';
import { AsyncResult, Atom } from 'effect/reactivity';
import { readReviewMarks } from '@porcelain/client/reviews';
import {
  revisionDecisionStates,
  revisionReviewItems,
  walkthroughStops,
} from '@porcelain/client/reviews/rules';
import type { Workspace } from '../../projects';
import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import { reviewTab } from '../rules/review-tab';
import { useWorkspaceReview } from './linked-review';

const inactiveMarks = Atom.make<Atom.Type<ReturnType<typeof readReviewMarks>>>(
  AsyncResult.initial(),
);

export function useReviewTab(
  workspace: Workspace,
  comparison: ReviewComparison,
) {
  const {
    published: review,
    revision,
    settled,
    specsApart,
  } = useWorkspaceReview(workspace);
  const published = AsyncResult.isSuccess(review) ? review.value : undefined;
  const marks = useAtomValue(
    published?.reviewId
      ? readReviewMarks({
          connection: workspace.connection,
          reviewId: published.reviewId,
        })
      : inactiveMarks,
  );
  const selected = AsyncResult.isSuccess(revision)
    ? revision.value.revision
    : undefined;
  return reviewTab(
    published === undefined ? undefined : published !== null,
    selected && settled && AsyncResult.isSuccess(marks) && !marks.waiting
      ? {
          stops: walkthroughStops(
            selected.content,
            selected.files.map((file) => file.path),
            { specsApart },
          ),
          items: revisionReviewItems(selected, marks.value),
          decisions: revisionDecisionStates(selected, marks.value),
        }
      : undefined,
    comparison,
  );
}
