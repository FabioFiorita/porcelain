import { useLocalSearchParams } from 'expo-router';
import {
  ReviewCommentsScreen,
  decodeCommentAnchor,
  decodeCommentReview,
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
    review?: string;
    revision?: string;
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
      review={decodeCommentReview(params.review, params.revision)}
    />
  );
}

export { ReviewCommentsRoute as default };
