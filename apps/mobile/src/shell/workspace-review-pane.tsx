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

const noOverview = () => null;

export function WorktreeChangesPane({
  workspace,
}: {
  workspace?: string | undefined;
}) {
  return (
    <ReviewPane
      workspace={workspace}
      linkedReview={LinkedReviewPane}
      currentReview={CurrentWorkspaceReview}
      publishedOverview={noOverview}
    />
  );
}
