import {
  Picker,
  RNHostView,
  Text,
  Toolbar,
  ToolbarItem,
  VStack,
} from '@expo/ui/swift-ui';
import {
  containerRelativeFrame,
  padding,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { Slot, usePathname, useRouter } from 'expo-router';
import { View } from 'react-native';

const destinations = [
  { path: '/', title: 'Review' },
  { path: '/files', title: 'Files' },
  { path: '/history', title: 'History' },
  { path: '/settings', title: 'Settings' },
];

export function TabletDetail() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Toolbar>
      <VStack spacing={0}>
        <Picker
          label="Workspace destination"
          selection={pathname}
          onSelectionChange={(path) => router.replace(path)}
          modifiers={[
            pickerStyle('segmented'),
            padding(),
            containerRelativeFrame({ axes: 'horizontal' }),
          ]}
        >
          {destinations.map((destination) => (
            <Text key={destination.path} modifiers={[tag(destination.path)]}>
              {destination.title}
            </Text>
          ))}
        </Picker>
        <RNHostView>
          <View style={{ flex: 1 }}>
            <Slot />
          </View>
        </RNHostView>
      </VStack>
      <Toolbar.Content>
        <ToolbarItem placement="principal">
          <Text>Workspace</Text>
        </ToolbarItem>
      </Toolbar.Content>
    </Toolbar>
  );
}
