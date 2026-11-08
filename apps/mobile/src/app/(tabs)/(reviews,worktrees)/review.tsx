import { useLocalSearchParams } from 'expo-router';
import { ReviewScreen } from '../../../features/reviews';

export default function ReviewRoute() {
  const { workspace, reviewId, environmentId } = useLocalSearchParams<{
    workspace?: string;
    reviewId?: string;
    environmentId?: string;
  }>();
  return (
    <ReviewScreen
      workspace={workspace}
      review={
        reviewId && environmentId ? { reviewId, environmentId } : undefined
      }
    />
  );
}
