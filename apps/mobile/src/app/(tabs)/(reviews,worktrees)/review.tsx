import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../components/ui/screen';
import { WorkspaceReviewPane } from '../../../shell/workspace-review-pane';

export default function ReviewRoute() {
  const { workspace, reviewId, environmentId } = useLocalSearchParams<{
    workspace?: string;
    reviewId?: string;
    environmentId?: string;
  }>();
  return (
    <Screen layout="fixed">
      <WorkspaceReviewPane
        workspace={workspace}
        review={
          reviewId && environmentId ? { reviewId, environmentId } : undefined
        }
      />
    </Screen>
  );
}
