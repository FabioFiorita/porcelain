import { useLocalSearchParams } from 'expo-router';
import { HistoryScreen } from '../../../features/history';

export default function HistoryRoute() {
  const { workspace } = useLocalSearchParams<{ workspace?: string }>();
  return <HistoryScreen workspace={workspace} />;
}
