import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { usePathname, useRouter } from 'expo-router';
import { Box } from '../components/ui/box';
import { Item } from '../components/ui/item';
import { Icon } from '../components/ui/icon';
import { Text } from '../components/ui/text';
import { Separator } from '../components/ui/separator';
import {
  UpdatesButton,
  UpdatesSheet,
  useUpdatesIndicator,
} from '../features/access';
import {
  WorktreeNavigator,
  requestDocumentLeave,
  useOpenComputers,
} from '../features/projects';
import { destinationForPath } from './destinations';

const StyledSafeAreaView = withUniwind(SafeAreaView);

export function TabletSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const inSettings = destinationForPath(pathname).group === '(settings)';
  const updateIndicator = useUpdatesIndicator();
  const [updates, setUpdates] = useState(false);
  const openComputers = useOpenComputers();
  return (
    <StyledSafeAreaView
      edges={['top', 'left', 'bottom']}
      className="flex-1 bg-sidebar"
    >
      <Box paddingTop={2}>
        <Box className="h-13 justify-center" paddingX={4}>
          <Text variant="heading">Porcelain</Text>
        </Box>
      </Box>
      <WorktreeNavigator
        onSelect={() => {
          if (pathname !== '/files') router.replace('/files');
        }}
      />
      <Separator />
      <Box className="flex-row items-center" gap={2} paddingX={4} paddingY={3}>
        <Box className="min-w-0 flex-1">
          <Item
            title="Settings"
            leading={<Icon name="settings" />}
            selected={inSettings}
            accessibilityLabel="Settings"
            testID="sidebar-settings"
            onPress={() => {
              if (!inSettings)
                requestDocumentLeave(() => router.replace('/settings'));
            }}
          />
        </Box>
        {updateIndicator.visible ? (
          <UpdatesButton
            running={updateIndicator.running}
            onPress={() => setUpdates(true)}
          />
        ) : null}
      </Box>
      <UpdatesSheet
        presented={updates}
        onClose={() => setUpdates(false)}
        onManageComputers={openComputers}
      />
    </StyledSafeAreaView>
  );
}
