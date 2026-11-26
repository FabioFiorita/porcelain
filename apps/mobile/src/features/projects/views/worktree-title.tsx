import { Stack, useRouter } from 'expo-router';
import { HeaderTitle } from '../../../components/ui/header-title';
import { useSelectedWorktree } from './worktrees-screen';

const pageActionSpace = 2;

export function WorktreeTitleButton() {
  const selected = useSelectedWorktree();
  const router = useRouter();
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
        accessibilityHint="Opens the worktree list"
        onPress={() => router.push('/worktrees')}
      />
    </Stack.Title>
  );
}
