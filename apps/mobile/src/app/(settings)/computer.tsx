import { useLocalSearchParams } from 'expo-router';
import { ComputerScreen } from '../../features/access';

export default function ComputerRoute() {
  const { environmentId } = useLocalSearchParams<{ environmentId?: string }>();
  return <ComputerScreen environmentId={environmentId} />;
}
