import { SettingsPresentation } from '../../shell/settings-presentation';
import { useRouter } from 'expo-router';

export default function SettingsRoute() {
  const router = useRouter();
  return (
    <SettingsPresentation
      onOpenGeneral={() => router.push('/general')}
      onOpenReviewsGit={() => router.push('/reviews-git')}
      onOpenComputers={() => router.push('/computers')}
      onOpenComponentLibrary={() => router.push('/component-library')}
    />
  );
}
