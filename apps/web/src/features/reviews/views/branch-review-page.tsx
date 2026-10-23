import { useState } from 'react';
import { AsyncResult } from 'effect/reactivity';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { usePublishedReview } from '../queries/published-review';
import { useReviewRevisionSelection } from '../store';
import { ReviewPage } from './review-page';
import { ReviewEmpty } from './review-empty';

export function BranchReviewPage({
  scope,
  context,
  initialView,
  active,
  toolbarTarget,
}: {
  toolbarTarget?: HTMLElement | null | undefined;
  scope: ReviewScope;
  context: ConnectionContext;
  initialView?: 'proof';
  active?: boolean | undefined;
}) {
  const published = usePublishedReview(scope, context);
  const [deleted, setDeleted] = useState<string>();
  const reviewId = published.review?.reviewId;
  const selection = useReviewRevisionSelection(reviewId ?? '');
  if (AsyncResult.isInitial(published.result))
    return (
      <p role="status" className="p-4">
        Loading review…
      </p>
    );
  if (AsyncResult.isFailure(published.result))
    return (
      <ReviewEmpty
        title="Review unavailable"
        description="The branch review could not be read. Try opening it from the project's Reviews list."
      />
    );
  if (!reviewId || reviewId === deleted)
    return (
      <ReviewEmpty
        title="No review on this branch"
        description="Publish a review for this branch, or open an existing review from the project's Reviews list."
      />
    );
  return (
    <ReviewPage
      key={selection.request}
      toolbarTarget={toolbarTarget}
      proofCurrent={published.review?.proof.current}
      active={active}
      reviewId={reviewId}
      revision={selection.revision}
      context={context}
      onRevision={selection.choose}
      onBack={() => selection.choose(undefined)}
      onDeleted={() => {
        setDeleted(reviewId);
        published.refresh();
      }}
      liveScope={scope}
      initialView={initialView}
    />
  );
}
