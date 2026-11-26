import { Stack } from 'expo-router';
import { View } from 'react-native';
import { ReadingConnection, useEnvironments } from '../features/access';
import { WorktreesScreen, useSelectedWorktree } from '../features/projects';
import { worktreeListNoticeComputer } from '../shared/rules/list-notice';

export function WorktreesHome() {
  const selected = useSelectedWorktree();
  const listComputer = worktreeListNoticeComputer({
    selected: selected?.environment,
    computers: useEnvironments(),
  });
  return (
    <View className="flex-1" collapsable={false}>
      <Stack.Screen options={{ title: 'Worktrees' }} />
      <WorktreesScreen />
      {listComputer ? <ReadingConnection remote={listComputer} /> : null}
    </View>
  );
}
