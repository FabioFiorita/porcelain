import { useLocalSearchParams } from 'expo-router';
import {
  ChangesPageScreen,
  reviewComparison,
} from '../../../features/workspace/index';

function ReviewChangesRoute() {
  const params = useLocalSearchParams<{
    workspace?: string;
    comparison?: string;
    walkthrough?: string;
    base?: string;
  }>();
  return (
    <ChangesPageScreen
      workspaceKey={params.workspace}
      comparison={reviewComparison(params.comparison, params.base)}
      walkthrough={params.walkthrough === 'true'}
    />
  );
}

export { ReviewChangesRoute as default };
