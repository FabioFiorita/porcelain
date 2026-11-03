import { useRouter } from 'expo-router';
import { PairComputerSheet } from '../../features/access';

export default function PairComputerRoute() {
  const router = useRouter();
  return <PairComputerSheet onClose={() => router.back()} />;
}
