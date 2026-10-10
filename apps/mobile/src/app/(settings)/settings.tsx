import { SettingsScreen } from '../../features/access';
import { useRouter } from 'expo-router';

export default function SettingsRoute() {
  const router = useRouter();
  return (
    <SettingsScreen
      onOpenAppearance={() => router.push('/appearance')}
      onOpenComponentLibrary={() => router.push('/component-library')}
    />
  );
}
