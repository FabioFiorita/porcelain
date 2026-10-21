import { Stack, useRouter } from 'expo-router';
import { WorktreeNavigator } from './worktree-navigator';

export function WorkspacePickerScreen() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: 'Worktrees' }} />
      <WorktreeNavigator nativeHeader onSelect={() => router.back()} />
    </>
  );
}
