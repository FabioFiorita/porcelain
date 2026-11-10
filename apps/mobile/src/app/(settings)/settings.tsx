import { Stack, useRouter } from 'expo-router';
import { SettingsScreen } from '../../features/access';
import { headerIcon } from '../../shared/icons/header-icon';
import { keyCommandsSupported } from '../../features/keyboard';

export default function SettingsRoute() {
  const router = useRouter();
  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={headerIcon('close')}
          accessibilityLabel="Close Settings"
          onPress={() => router.back()}
        />
      </Stack.Toolbar>
      <SettingsScreen
        onOpenGeneral={() => router.push('/general')}
        onOpenReviewsGit={() => router.push('/reviews-git')}
        onOpenNotifications={() => router.push('/notifications')}
        onOpenComputers={() => router.push('/computers')}
        onOpenComponentLibrary={() => router.push('/component-library')}
        {...(keyCommandsSupported
          ? { onOpenShortcuts: () => router.push('/keyboard-shortcuts') }
          : {})}
      />
    </>
  );
}
