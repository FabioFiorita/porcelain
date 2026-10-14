import { SettingsPresentation } from '../../shell/settings-presentation';
import { useRouter } from 'expo-router';

export default function SettingsRoute() {
  const router = useRouter();
  return (
    <SettingsPresentation
      onOpenAppearance={() => router.push('/appearance')}
      onOpenComponentLibrary={() => router.push('/component-library')}
    />
  );
}
