import { useRouter } from 'expo-router';
import { EnvironmentsSettings } from '../../features/access';

export default function ComputersRoute() {
  const router = useRouter();
  return (
    <EnvironmentsSettings
      onAddComputer={() => router.push('/pair-computer')}
      onOpenComputer={(environmentId) =>
        router.push({ pathname: '/computer', params: { environmentId } })
      }
    />
  );
}
