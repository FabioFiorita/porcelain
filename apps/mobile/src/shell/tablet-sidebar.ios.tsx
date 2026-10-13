import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { usePathname, useRouter } from 'expo-router';
import { Box } from '../components/ui/box';
import { Item } from '../components/ui/item';
import { Icon } from '../components/ui/icon';
import { Text } from '../components/ui/text';
import { Separator } from '../components/ui/separator';
import { WorktreeNavigator } from '../features/projects';
import { destinationForPath } from './destinations';

const StyledSafeAreaView = withUniwind(SafeAreaView);

export function TabletSidebar({ windowed }: { windowed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const inSettings = destinationForPath(pathname).group === '(settings)';
  return (
    <StyledSafeAreaView
      edges={['top', 'left', 'bottom']}
      className="flex-1 bg-muted/40"
    >
      <Box {...(windowed ? { paddingTop: 8 } : {})}>
        <Box paddingX={4} paddingY={4}>
          <Text variant="heading">Porcelain</Text>
        </Box>
      </Box>
      <WorktreeNavigator
        onSelect={() => {
          if (pathname !== '/files') router.replace('/files');
        }}
      />
      <Separator />
      <Box paddingX={4} paddingY={3}>
        <Item
          title="Settings"
          leading={<Icon name="settings" />}
          selected={inSettings}
          accessibilityLabel="Settings"
          testID="sidebar-settings"
          onPress={() => {
            if (!inSettings) router.replace('/settings');
          }}
        />
      </Box>
    </StyledSafeAreaView>
  );
}
