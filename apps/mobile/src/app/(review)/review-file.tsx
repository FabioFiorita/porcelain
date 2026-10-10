import { useLocalSearchParams } from 'expo-router';
import { ReviewFileScreen, reviewComparison } from '../../features/reviews';
import { DestinationScreen } from '../../shell/destination-screen';

function ReviewFileRoute() {
  const params = useLocalSearchParams<{
    workspace?: string;
    path?: string;
    comparison?: string;
    base?: string;
  }>();
  return (
    <DestinationScreen>
      <ReviewFileScreen
        workspaceKey={params.workspace}
        path={params.path}
        comparison={reviewComparison(params.comparison, params.base)}
      />
    </DestinationScreen>
  );
}

export { ReviewFileRoute as default };
