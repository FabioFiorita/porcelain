import { useLocalSearchParams, useRouter } from 'expo-router';
import { CommentSheet } from '../features/comments';

export default function CommentRoute() {
  const router = useRouter();
  const params = useLocalSearchParams();
  return <CommentSheet params={params} onClose={() => router.back()} />;
}
