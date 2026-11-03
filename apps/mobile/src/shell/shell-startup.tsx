import { useAtomMount } from '@effect/atom-react';
import { Stack } from 'expo-router';
import { sheetOptions } from '../components/ui/sheet';
import { shellStartup } from '../shared/application/store';

export function ShellStartup() {
  useAtomMount(shellStartup);
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
        options={{ title: 'Comments', ...sheetOptions('tall') }}
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
        name="archive-review"
        options={{ title: 'Archive review', ...sheetOptions('tall') }}
      />
    </Stack>
  );
}
