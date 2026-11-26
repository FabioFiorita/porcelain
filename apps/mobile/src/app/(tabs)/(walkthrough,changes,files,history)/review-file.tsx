import { useLocalSearchParams } from 'expo-router';
import { ReviewFileScreen } from '../../../features/workspace/index';
import { reviewComparison } from '../../../features/workspace/index';

function ReviewFileRoute() {
  const params = useLocalSearchParams<{
    workspace?: string;
    path?: string;
    comparison?: string;
    base?: string;
  }>();
  return (
    <ReviewFileScreen
      workspaceKey={params.workspace}
      path={params.path}
      comparison={reviewComparison(params.comparison, params.base)}
    />
  );
}

export { ReviewFileRoute as default };
