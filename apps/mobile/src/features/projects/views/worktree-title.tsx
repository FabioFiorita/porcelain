import { Stack } from 'expo-router';
import { useWorktreeDrawer } from './worktree-drawer';
import { HeaderTitle } from '../../../components/ui/header-title';
import { useSelectedWorktree } from './worktrees-screen';

const pageActionSpace = 2;

export function WorktreeTitleButton() {
  const selected = useSelectedWorktree();
  const drawer = useWorktreeDrawer();
  const title = selected?.title ?? 'Choose a worktree';
  return (
    <Stack.Title asChild>
      <HeaderTitle
        testID="worktree-switch"
        title={title}
        subtitle={
          selected
            ? [selected.project, selected.computer].filter(Boolean).join(' · ')
            : undefined
        }
        trailingItems={pageActionSpace}
        accessibilityLabel={selected ? `Worktree ${title}` : title}
        accessibilityHint="Shows the worktree list"
        onPress={drawer.show}
      />
    </Stack.Title>
  );
}
