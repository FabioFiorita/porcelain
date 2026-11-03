import { useLocalSearchParams } from 'expo-router';
import { ReviewFileScreen, reviewComparison } from '../../../features/reviews';

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
