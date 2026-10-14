import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Host } from '@expo/ui/swift-ui';
import { withUniwind } from 'uniwind';
import { usePathname, useRouter } from 'expo-router';
import { Box } from '../components/ui/box';
import { Item } from '../components/ui/item';
import { Icon } from '../components/ui/icon';
import { Text } from '../components/ui/text';
import { Separator } from '../components/ui/separator';
import { destinations, destinationForPath } from './destinations';

const StyledSafeAreaView = withUniwind(SafeAreaView);

function SidebarDestination({
  destination,
  onNavigate,
}: {
  destination: (typeof destinations)[number];
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const selectedPath = destinationForPath(pathname).path;
  const router = useRouter();
  return (
    <Item
      title={destination.title}
      leading={<Icon name={destination.icon} />}
      selected={selectedPath === destination.path}
      accessibilityLabel={destination.title}
      testID={destination.sidebarId}
      onPress={() => {
        if (pathname !== destination.path) router.replace(destination.path);
        onNavigate();
      }}
    />
  );
}

export function TabletSidebar({
  onNavigate,
  onClose,
}: {
  onNavigate: () => void;
  onClose?: () => void;
}) {
  return (
    <StyledSafeAreaView
      edges={['top', 'left', 'bottom']}
      className="flex-1 bg-muted/40"
    >
      <Box
        className="flex-row items-center justify-between"
        paddingX={4}
        paddingY={4}
      >
        <Text variant="heading">Porcelain</Text>
        {onClose ? (
          <Host matchContents>
            <Button
              label="Hide sidebar"
              systemImage="sidebar.left"
              onPress={onClose}
            />
          </Host>
        ) : null}
      </Box>
      <ScrollView className="flex-1" contentInsetAdjustmentBehavior="automatic">
        <Box gap={1} paddingX={4}>
          {destinations
            .filter((destination) => destination.group !== '(settings)')
            .map((destination) => (
              <SidebarDestination
                key={destination.path}
                destination={destination}
                onNavigate={onNavigate}
              />
            ))}
        </Box>
      </ScrollView>
      <Separator />
      <Box paddingX={4} paddingY={3}>
        {destinations
          .filter((destination) => destination.group === '(settings)')
          .map((destination) => (
            <SidebarDestination
              key={destination.path}
              destination={destination}
              onNavigate={onNavigate}
            />
          ))}
      </Box>
    </StyledSafeAreaView>
  );
}
