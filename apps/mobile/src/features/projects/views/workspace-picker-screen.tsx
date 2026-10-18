import { Stack, useRouter } from 'expo-router';
import { headerIcon } from '../../../shared/icons/header-icon';
import { WorktreeNavigator } from './worktree-navigator';

export function WorkspacePickerScreen() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: 'Choose workspace' }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={headerIcon('close')}
          accessibilityLabel="Close workspace picker"
          onPress={() => router.back()}
        >
          Close
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <WorktreeNavigator onSelect={() => router.back()} />
    </>
  );
}
