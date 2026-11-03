import { useLocalSearchParams } from 'expo-router';
import { ReviewScreen } from '../../../features/reviews';

export default function ReviewRoute() {
  const { workspace } = useLocalSearchParams<{ workspace?: string }>();
  return <ReviewScreen workspace={workspace} />;
}
