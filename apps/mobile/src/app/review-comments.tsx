import { useLocalSearchParams } from 'expo-router';
import {
  ReviewCommentsScreen,
  decodeCommentAnchor,
  decodeCommentReview,
  reviewComparison,
} from '../features/reviews';

function ReviewCommentsRoute() {
  const params = useLocalSearchParams<{
    workspace?: string;
    path?: string;
    anchor?: string;
    compose?: string;
    comparison?: string;
    base?: string;
    thread?: string;
    origin?: string;
    body?: string;
    review?: string;
    revision?: string;
    feedbackWritable?: string;
  }>();
  return (
    <ReviewCommentsScreen
      workspaceKey={params.workspace}
      path={params.path}
      anchor={decodeCommentAnchor(params.anchor)}
      compose={params.compose === 'true'}
      comparison={reviewComparison(params.comparison, params.base)}
      thread={params.thread}
      fromDecision={params.origin === 'decision'}
      body={params.body}
      review={decodeCommentReview(params.review, params.revision)}
      feedbackWritable={params.feedbackWritable === 'true'}
    />
  );
}

export { ReviewCommentsRoute as default };
