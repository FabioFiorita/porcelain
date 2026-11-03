import { useLocalSearchParams } from 'expo-router';
import { ReviewSummaryScreen } from '../../../features/reviews';

export default function ReviewSummaryRoute() {
  const { workspace } = useLocalSearchParams<{ workspace?: string }>();
  return <ReviewSummaryScreen workspace={workspace} />;
}
