import { Stack } from 'expo-router';
import { useWorktreeDrawer } from '../features/projects';
import { headerIcon } from '../shared/icons/header-icon';

export function DrawerToolbar() {
  const drawer = useWorktreeDrawer();
  const showing = drawer.mode === 'pinned' ? !drawer.hidden : drawer.open;
  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button
        icon={headerIcon(showing ? 'hideList' : 'showList')}
        accessibilityLabel={showing ? 'Hide worktrees' : 'Show worktrees'}
        onPress={drawer.toggle}
      />
    </Stack.Toolbar>
  );
}
