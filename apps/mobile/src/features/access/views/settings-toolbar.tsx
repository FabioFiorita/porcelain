import { Stack, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { headerIcon } from '../../../shared/icons/header-icon';

export function SettingsToolbar({ children }: { children?: ReactNode }) {
  const router = useRouter();
  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button
        icon={headerIcon('settings')}
        accessibilityLabel="Settings"
        onPress={() => router.push('/settings')}
      />
      {children}
    </Stack.Toolbar>
  );
}
