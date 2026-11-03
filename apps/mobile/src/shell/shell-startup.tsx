import { useAtomMount } from '@effect/atom-react';
import { Stack } from 'expo-router';
import { shellStartup } from '../shared/application/store';

export function ShellStartup() {
  useAtomMount(shellStartup);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(settings)" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
