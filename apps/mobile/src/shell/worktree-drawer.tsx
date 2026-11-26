import { View } from 'react-native';
import { Box } from '../components/ui/box';
import { Text } from '../components/ui/text';
import { ReadingConnection, useEnvironments } from '../features/access';
import { WorktreesScreen, useSelectedWorktree } from '../features/projects';
import { worktreeListNoticeComputer } from '../shared/rules/list-notice';
import { SidebarSections } from './sidebar-sections';

export function WorktreeDrawer({ sections }: { sections: boolean }) {
  const selected = useSelectedWorktree();
  const listComputer = worktreeListNoticeComputer({
    selected: selected?.environment,
    computers: useEnvironments(),
  });
  return (
    <View className="flex-1" collapsable={false} testID="worktree-drawer">
      {sections ? (
        <Box paddingTop={2}>
          <SidebarSections />
        </Box>
      ) : null}
      <Box paddingX={4} paddingY={3}>
        <Text variant="title" weight="semibold" accessibilityRole="header">
          Worktrees
        </Text>
      </Box>
      <View className="flex-1" collapsable={false}>
        <WorktreesScreen />
        {listComputer ? <ReadingConnection remote={listComputer} /> : null}
      </View>
    </View>
  );
}
