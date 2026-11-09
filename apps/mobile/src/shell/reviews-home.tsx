import { useAtomValue } from '@effect/atom-react';
import { Empty } from '../components/ui/empty';
import { ListDetail } from '../components/ui/list-detail';
import {
  ReviewInbox,
  openedReview,
  type OpenedReview,
} from '../features/projects/index';
import { LinkedReviewPane } from '../features/reviews/index';
import { WorkspaceReviewPane } from './workspace-review-pane';

export function ReviewsHome() {
  const review = useAtomValue(openedReview);
  return (
    <ListDetail
      list={(mode) => <ReviewInbox mode={mode} />}
      detail={<ReviewDetail review={review} />}
    />
  );
}

function ReviewDetail({ review }: { review: OpenedReview | undefined }) {
  if (!review)
    return (
      <Empty
        title="Select a review"
        description="Choose a review on the left to read it here."
      />
    );
  if (review.workspace)
    return (
      <WorkspaceReviewPane
        key={`${review.environmentId}:${review.reviewId}`}
        workspace={review.workspace}
        review={review}
      />
    );
  return (
    <LinkedReviewPane
      key={`${review.environmentId}:${review.reviewId}`}
      review={review}
    />
  );
}
