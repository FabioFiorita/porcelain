import { useLocalSearchParams } from 'expo-router';
import { WalkthroughWriterSheet } from '../features/walkthroughs';

export default function WalkthroughWriterRoute() {
  const params = useLocalSearchParams<{ workspace?: string }>();
  return <WalkthroughWriterSheet workspace={params.workspace} />;
}
