import { useLocalSearchParams } from 'expo-router';
import {
  ReviewCommentsScreen,
  decodeCommentAnchor,
  reviewComparison,
} from '../../features/reviews';

function ReviewCommentsRoute() {
  const params = useLocalSearchParams<{
    workspace?: string;
    path?: string;
    anchor?: string;
    compose?: string;
    comparison?: string;
    base?: string;
    thread?: string;
    body?: string;
  }>();
  return (
    <ReviewCommentsScreen
      workspaceKey={params.workspace}
      path={params.path}
      anchor={decodeCommentAnchor(params.anchor)}
      compose={params.compose === 'true'}
      comparison={reviewComparison(params.comparison, params.base)}
      thread={params.thread}
      body={params.body}
    />
  );
}

export { ReviewCommentsRoute as default };
