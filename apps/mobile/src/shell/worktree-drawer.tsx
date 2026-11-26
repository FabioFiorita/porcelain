import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Box } from '../components/ui/box';
import { Icon } from '../components/ui/icon';
import { Item } from '../components/ui/item';
import { Separator } from '../components/ui/separator';
import { Text } from '../components/ui/text';
import { ReadingConnection, useEnvironments } from '../features/access';
import {
  WorktreesScreen,
  useSelectedWorktree,
  useWorktreeDrawer,
} from '../features/projects';
import { worktreeListNoticeComputer } from '../shared/rules/list-notice';

export function WorktreeDrawer() {
  const router = useRouter();
  const drawer = useWorktreeDrawer();
  const selected = useSelectedWorktree();
  const listComputer = worktreeListNoticeComputer({
    selected: selected?.environment,
    computers: useEnvironments(),
  });
  return (
    <View className="flex-1" collapsable={false} testID="worktree-drawer">
      <Box paddingX={4} paddingY={3}>
        <Text variant="title" weight="semibold" accessibilityRole="header">
          Worktrees
        </Text>
      </Box>
      <View className="flex-1" collapsable={false}>
        <WorktreesScreen />
        {listComputer ? <ReadingConnection remote={listComputer} /> : null}
      </View>
      <Separator />
      <Box>
        <Item
          testID="drawer-settings"
          title="Settings"
          leading={<Icon name="settings" tone="muted" />}
          onPress={() => {
            drawer.close();
            router.push('/settings');
          }}
        />
      </Box>
    </View>
  );
}
