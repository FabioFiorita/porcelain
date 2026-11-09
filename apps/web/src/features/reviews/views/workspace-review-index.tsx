import {
  ReviewIndex,
  usePublishedReview,
  type ReviewIndexProps,
} from '../../workspace/index';
import { useReviewRevisionSelection, useWalkthroughPlace } from '../store';
import { ReviewNavigation } from './review-navigation';
import { BranchReadiness, ChangeReadiness } from './readiness-panel';

export function WorkspaceReviewIndex(props: ReviewIndexProps) {
  const { review } = usePublishedReview(props.scope, props.context);
  const selection = useReviewRevisionSelection(review?.reviewId ?? '');
  const place = useWalkthroughPlace(
    `${review?.reviewId ?? props.scope.worktreeId}:${review?.revision ?? ''}`,
  );
  return (
    <ReviewIndex
      {...props}
      reviewNavigation={ReviewNavigation}
      branchReadiness={BranchReadiness}
      changeReadiness={ChangeReadiness}
      onReviewReadiness={(key) => {
        if (key === 'checks') {
          selection.choose(undefined);
          place.setPlace('briefing');
        }
        if (key === 'unexplained' && review) place.setPlace('unexplained');
      }}
    />
  );
}
