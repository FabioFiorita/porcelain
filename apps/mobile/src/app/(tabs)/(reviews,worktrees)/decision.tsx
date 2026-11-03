import { useLocalSearchParams } from 'expo-router';
import { DecisionScreen } from '../../../features/reviews';

export default function DecisionRoute() {
  const { workspace, stop } = useLocalSearchParams<{
    workspace?: string;
    stop?: string;
  }>();
  return <DecisionScreen workspace={workspace} stop={stop} />;
}
