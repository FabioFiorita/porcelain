import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
}: {
  destination: (typeof destinations)[number];
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
      }}
    />
  );
}

export function TabletSidebar({ windowed }: { windowed: boolean }) {
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
      <ScrollView className="flex-1" contentInsetAdjustmentBehavior="automatic">
        <Box gap={1} paddingX={4}>
          {destinations
            .filter((destination) => destination.group !== '(settings)')
            .map((destination) => (
              <SidebarDestination
                key={destination.path}
                destination={destination}
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
            />
          ))}
      </Box>
    </StyledSafeAreaView>
  );
}
