import { useLocalSearchParams } from 'expo-router';
import { WalkthroughScreenshotSheet } from '../features/walkthroughs';

export default function WalkthroughScreenshotRoute() {
  const params = useLocalSearchParams<{
    workspace?: string;
    run?: string;
    step?: string;
    index?: string;
  }>();
  return (
    <WalkthroughScreenshotSheet
      workspace={params.workspace}
      run={params.run}
      step={params.step}
      index={params.index}
    />
  );
}
