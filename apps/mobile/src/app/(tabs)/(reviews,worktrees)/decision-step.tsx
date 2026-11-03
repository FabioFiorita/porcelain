import { useLocalSearchParams } from 'expo-router';
import { DecisionStepScreen } from '../../../features/reviews';

export default function DecisionStepRoute() {
  const { workspace, stop, step } = useLocalSearchParams<{
    workspace?: string;
    stop?: string;
    step?: string;
  }>();
  return <DecisionStepScreen workspace={workspace} stop={stop} step={step} />;
}
