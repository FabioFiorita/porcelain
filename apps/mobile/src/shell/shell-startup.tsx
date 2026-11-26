import { useAtomMount } from '@effect/atom-react';
import { Stack } from 'expo-router';
import { sheetOptions } from '../components/ui/sheet';
import { shellStartup } from '../shared/application/store';
import {
  keyCommandRouting,
  keyCommandSync,
} from '../shared/application/key-commands';
import { useAppKeyCommands } from './app-key-commands';
import { gitSuccessNotices } from '../features/git-actions';

export function ShellStartup() {
  useAtomMount(shellStartup);
  useAtomMount(keyCommandSync);
  useAtomMount(keyCommandRouting);
  useAtomMount(gitSuccessNotices);
  useAppKeyCommands();
  return (
    <Stack
      screenOptions={({ theme }) => ({
        headerShown: false,
        headerTintColor: theme.colors.text,
      })}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(settings)" options={{ presentation: 'modal' }} />
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen
        name="archive-pull-request"
        options={{ title: 'Archive pull request', ...sheetOptions('tall') }}
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
        name="comment"
        options={{ title: 'Comment', ...sheetOptions('half') }}
      />
      <Stack.Screen
        name="publish-comments"
        options={{ title: 'Publish', ...sheetOptions('tall') }}
      />
      <Stack.Screen
        name="walkthrough-writer"
        options={{ title: 'Writer', ...sheetOptions('tall') }}
      />
      <Stack.Screen
        name="merge-pull-request"
        options={{ title: 'Merge', ...sheetOptions('half') }}
      />
      <Stack.Screen
        name="keyboard-shortcuts"
        options={{ title: 'Keyboard Shortcuts', ...sheetOptions('tall') }}
      />
    </Stack>
  );
}
