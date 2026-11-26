import { Stack, useRouter } from 'expo-router';
import { useWorktreeDrawer } from '../features/projects';
import { headerIcon } from '../shared/icons/header-icon';

export function DrawerToolbar() {
  const router = useRouter();
  const drawer = useWorktreeDrawer();
  const showing = drawer.mode === 'pinned' ? !drawer.hidden : drawer.open;
  const labels =
    drawer.mode === 'pinned'
      ? { hide: 'Hide sidebar', show: 'Show sidebar' }
      : { hide: 'Hide worktrees', show: 'Show worktrees' };
  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button
        icon={headerIcon(showing ? 'hideList' : 'showList')}
        accessibilityLabel={showing ? labels.hide : labels.show}
        onPress={drawer.toggle}
      />
      <Stack.Toolbar.Button
        icon={headerIcon('settings')}
        accessibilityLabel="Settings"
        onPress={() => {
          drawer.close();
          router.push('/settings');
        }}
      />
    </Stack.Toolbar>
  );
}
