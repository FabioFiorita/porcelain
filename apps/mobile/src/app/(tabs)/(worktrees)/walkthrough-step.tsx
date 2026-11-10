import { useLocalSearchParams } from 'expo-router';
import { WalkthroughStepScreen } from '../../../features/walkthroughs';

export default function WalkthroughStepRoute() {
  const params = useLocalSearchParams<{ workspace?: string; step?: string }>();
  return (
    <WalkthroughStepScreen workspace={params.workspace} step={params.step} />
  );
}
