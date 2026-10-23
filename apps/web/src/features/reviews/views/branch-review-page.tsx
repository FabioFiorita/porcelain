import { useState } from 'react';
import { AsyncResult } from 'effect/reactivity';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { usePublishedReview } from '../queries/published-review';
import { useReviewRevisionSelection } from '../store';
import { ReviewPage } from './review-page';
import { Button } from '@/components/ui/button';
import { StateNotice, StateSkeleton } from '@/components/state-notice';

export function BranchReviewPage({
  scope,
  context,
  initialView,
  active,
}: {
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
    return <StateSkeleton label="Loading review" />;
  if (AsyncResult.isFailure(published.result))
    return (
      <StateNotice
        title="Could not display"
        description="The branch review could not be read."
      >
        <Button variant="outline" onClick={published.refresh}>
          Try again
        </Button>
      </StateNotice>
    );
  if (!reviewId || reviewId === deleted)
    return (
      <StateNotice
        title="No review on this branch"
        description="Publish a review for this branch, or open an existing review from the project's Reviews list."
      />
    );
  return (
    <ReviewPage
      key={selection.request}
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
