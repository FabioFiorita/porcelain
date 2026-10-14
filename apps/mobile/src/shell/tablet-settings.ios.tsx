import { useState } from 'react';
import { Dimensions, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { Box } from '../components/ui/box';
import { ChromeButton } from '../components/ui/chrome-button';
import { Item } from '../components/ui/item';
import { Icon } from '../components/ui/icon';
import { Separator } from '../components/ui/separator';
import { Text } from '../components/ui/text';
import { EnvironmentsSettings, useSettingsCategory } from '../features/access';
import { PreferencesScreen, useAppSidebar } from '../features/preferences';
import { ComponentExplorer } from '../features/catalog';

const categories = [
  {
    id: 'appearance',
    title: 'Appearance',
    icon: 'appearance',
    testID: 'settings-appearance',
  },
  {
    id: 'environments',
    title: 'Environments',
    icon: 'environments',
    testID: 'settings-environments',
  },
  {
    id: 'development',
    title: 'Development',
    icon: 'code',
    testID: 'settings-development',
  },
] as const;

const StyledSafeAreaView = withUniwind(SafeAreaView);

export function TabletSettings() {
  const { category, select } = useSettingsCategory();
  const { sidebar } = useAppSidebar();
  const [width, setWidth] = useState(0);
  const wide = width >= 700;
  const window = useWindowDimensions();
  const screen = Dimensions.get('screen');
  const windowed = window.width < screen.width || window.height < screen.height;
  return (
    <StyledSafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      className="min-w-0 flex-1 bg-background"
    >
      <Box
        className={wide ? 'min-w-0 flex-1 flex-row' : 'min-w-0 flex-1'}
        {...(windowed ? { paddingTop: 8 } : {})}
        onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}
      >
        <Box className={wide ? 'w-56 shrink-0' : 'grow-0'}>
          <Box
            className="flex-row items-center"
            gap={2}
            paddingX={4}
            paddingY={2}
          >
            {sidebar ? (
              <ChromeButton
                icon="sidebar"
                label={sidebar.visible ? 'Hide sidebar' : 'Show sidebar'}
                onPress={sidebar.toggle}
              />
            ) : null}
            <Text variant="heading">Settings</Text>
          </Box>
          <ScrollView
            className={wide ? 'flex-1' : 'grow-0'}
            horizontal={!wide}
            showsHorizontalScrollIndicator={false}
          >
            <Box className={wide ? '' : 'flex-row'} gap={1} padding={4}>
              {categories
                .filter((entry) => entry.id !== 'development' || __DEV__)
                .map((entry) => (
                  <Item
                    key={entry.id}
                    title={entry.title}
                    leading={<Icon name={entry.icon} />}
                    size="sm"
                    testID={entry.testID}
                    selected={entry.id === category}
                    onPress={() => select(entry.id)}
                  />
                ))}
            </Box>
          </ScrollView>
        </Box>
        <Separator orientation={wide ? 'vertical' : 'horizontal'} />
        <Box className="min-w-0 flex-1">
          <SettingsContent />
        </Box>
      </Box>
    </StyledSafeAreaView>
  );
}

function SettingsContent() {
  const { category } = useSettingsCategory();
  switch (category) {
    case 'appearance':
      return <PreferencesScreen />;
    case 'environments':
      return <EnvironmentsSettings />;
    case 'development':
      return __DEV__ ? <ComponentExplorer /> : null;
  }
}
