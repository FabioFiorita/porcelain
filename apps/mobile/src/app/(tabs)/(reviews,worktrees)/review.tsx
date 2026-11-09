import {
  LinkedReviewPane as SavedReviewPane,
  CurrentWorkspaceReview,
  WorkspacePublishedOverview,
} from '../../../features/reviews/index';
import { useLocalSearchParams } from 'expo-router';
import { ReviewScreen } from '../../../features/workspace/index';

export default function ReviewRoute() {
  const { workspace, reviewId, environmentId } = useLocalSearchParams<{
    workspace?: string;
    reviewId?: string;
    environmentId?: string;
  }>();
  return (
    <ReviewScreen
      linkedReview={SavedReviewPane}
      currentReview={CurrentWorkspaceReview}
      publishedOverview={WorkspacePublishedOverview}
      workspace={workspace}
      review={
        reviewId && environmentId ? { reviewId, environmentId } : undefined
      }
    />
  );
}
