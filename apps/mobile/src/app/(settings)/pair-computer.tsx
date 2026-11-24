import { useLocalSearchParams, useRouter } from 'expo-router';
import { PairComputerSheet } from '../../features/access';

export default function PairComputerRoute() {
  const router = useRouter();
  const { environment } = useLocalSearchParams<{ environment?: string }>();
  return (
    <PairComputerSheet
      environmentId={environment}
      onClose={() => router.back()}
      onScan={() => router.push('/scan-pairing-link')}
    />
  );
}
