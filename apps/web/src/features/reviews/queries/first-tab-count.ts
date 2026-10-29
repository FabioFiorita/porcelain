import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import { readReview, readReviewMarks } from '@porcelain/client/reviews';
import {
  revisionDecisionProgress,
  type ReviewResponse,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import { useSpecsApart } from '@/features/preferences/index';
import { useReviewOverview } from '@/features/changes/index';
import type { ConnectionContext } from '@/shared/workspace/connection';
import type { ReviewTitle } from '../rules/documents';
import { changesTabCount, reviewTabCount } from '../rules/tab-strip';
import { useReviewRevisionSelection } from '../store';

const inactiveReview = Atom.make<Atom.Type<ReturnType<typeof readReview>>>(
  AsyncResult.initial(),
);
const inactiveMarks = Atom.make<Atom.Type<ReturnType<typeof readReviewMarks>>>(
  AsyncResult.initial(),
);

export function useFirstTabCount({
  scope,
  context,
  review,
  reviewTitle,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  review: ReviewResponse | undefined;
  reviewTitle: ReviewTitle | undefined;
}) {
  const overview = useReviewOverview(scope, context.connection);
  const selection = useReviewRevisionSelection(review?.reviewId ?? '');
  const specsApart = useSpecsApart(context.connection);
  const read = useAtomValue(
    review?.reviewId
      ? readReview({
          connection: context.connection,
          reviewId: review.reviewId,
          ...(selection.revision === undefined
            ? {}
            : { revision: selection.revision }),
        })
      : inactiveReview,
  );
  const result = useAtomValue(
    review?.reviewId
      ? readReviewMarks({
          connection: context.connection,
          reviewId: review.reviewId,
        })
      : inactiveMarks,
  );
  if (!review?.reviewId) {
    const count =
      Option.getOrUndefined(AsyncResult.value(overview))?.changes.length ?? 0;
    return reviewTitle ? undefined : changesTabCount(count);
  }
  const revision = Option.getOrUndefined(AsyncResult.value(read))?.revision;
  const marks = Option.getOrUndefined(AsyncResult.value(result));
  const reviewed = revision
    ? revisionDecisionProgress(revision, marks, { specsApart }).reviewed
    : 0;
  return reviewTabCount(
    reviewed,
    revision?.content.layers.length ?? review.layers.length,
  );
}
