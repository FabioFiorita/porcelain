import { useState } from 'react';
import { ScrollView } from 'react-native';
import { TabletSurface } from '../components/ui/tablet-surface';
import { Box } from '../components/ui/box';
import { ChromeButton } from '../components/ui/chrome-button';
import { Item } from '../components/ui/item';
import { Icon } from '../components/ui/icon';
import { Separator } from '../components/ui/separator';
import { Text } from '../components/ui/text';
import {
  EnvironmentsSettings,
  useSettingsCategory,
  SettingsAbout,
} from '../features/access';
import {
  PreferencesScreen,
  ReviewsGitSettings,
  useAppSidebar,
} from '../features/preferences';
import { ComponentExplorer } from '../features/catalog';

const categories = [
  {
    id: 'general',
    title: 'General',
    icon: 'appearance',
    testID: 'settings-general',
  },
  {
    id: 'reviews-git',
    title: 'Reviews & Git',
    icon: 'review',
    testID: 'settings-reviews-git',
  },
  {
    id: 'computers',
    title: 'Computers',
    icon: 'environments',
    testID: 'settings-computers',
  },
  {
    id: 'development',
    title: 'Development',
    icon: 'code',
    testID: 'settings-development',
  },
] as const;

export function TabletSettings() {
  const { category, select } = useSettingsCategory();
  const { sidebar } = useAppSidebar();
  const [width, setWidth] = useState(0);
  const wide = width >= 700;
  return (
    <TabletSurface>
      <Box
        className={wide ? 'min-w-0 flex-1 flex-row' : 'min-w-0 flex-1'}
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
          <SettingsAbout />
        </Box>
        <Separator orientation={wide ? 'vertical' : 'horizontal'} />
        <Box className="min-w-0 flex-1">
          <SettingsContent />
        </Box>
      </Box>
    </TabletSurface>
  );
}

function SettingsContent() {
  const { category } = useSettingsCategory();
  switch (category) {
    case 'general':
      return <PreferencesScreen />;
    case 'reviews-git':
      return <ReviewsGitSettings />;
    case 'computers':
      return <EnvironmentsSettings inlinePairing />;
    case 'development':
      return __DEV__ ? <ComponentExplorer /> : null;
  }
}
