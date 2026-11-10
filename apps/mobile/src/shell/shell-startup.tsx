import { useAtomMount } from '@effect/atom-react';
import { Stack } from 'expo-router';
import { guardedSheetOptions, sheetOptions } from '../components/ui/sheet';
import { shellStartup } from '../shared/application/store';
import { notificationsSync } from '../features/notifications';

export function ShellStartup() {
  useAtomMount(shellStartup);
  useAtomMount(notificationsSync);
  return (
    <Stack
      screenOptions={({ theme }) => ({
        headerShown: false,
        headerTintColor: theme.colors.text,
      })}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(settings)" options={{ presentation: 'modal' }} />
      <Stack.Screen
        name="review-comments"
        options={{ title: 'Comments', ...guardedSheetOptions }}
      />
      <Stack.Screen
        name="worktree-actions"
        options={{ title: 'Worktree', ...sheetOptions('half') }}
      />
      <Stack.Screen
        name="rename-project"
        options={{ title: 'Rename project', ...sheetOptions('half') }}
      />
      <Stack.Screen
        name="file-action"
        options={{ title: 'File', ...sheetOptions('half') }}
      />
      <Stack.Screen
        name="walkthrough-screenshot"
        options={{ title: 'Screenshot', ...sheetOptions('tall') }}
      />
      <Stack.Screen
        name="archive-review"
        options={{ title: 'Archive review', ...sheetOptions('tall') }}
      />
    </Stack>
  );
}
