import { Stack, useRouter } from 'expo-router';
import { headerIcon } from '../../../shared/icons/header-icon';

export function SettingsToolbar() {
  const router = useRouter();
  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button
        icon={headerIcon('settings')}
        accessibilityLabel="Settings"
        onPress={() => router.push('/settings')}
      />
    </Stack.Toolbar>
  );
}
