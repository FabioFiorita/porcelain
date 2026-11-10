import {
  CurrentWorkspaceReview,
  LinkedReviewPane,
  WorkspacePublishedOverview,
} from '../features/reviews/index';
import { ReviewPane, type ReviewPaneProps } from '../features/workspace/index';

export function WorkspaceReviewPane(
  props: Pick<ReviewPaneProps, 'workspace' | 'review'>,
) {
  return (
    <ReviewPane
      linkedReview={LinkedReviewPane}
      currentReview={CurrentWorkspaceReview}
      publishedOverview={WorkspacePublishedOverview}
      {...props}
    />
  );
}
