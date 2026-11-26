import { useLocalSearchParams } from 'expo-router';
import { PublishCommentsSheet } from '../features/comments';

export default function PublishCommentsRoute() {
  const params = useLocalSearchParams<{ workspace?: string }>();
  return <PublishCommentsSheet workspace={params.workspace} />;
}
