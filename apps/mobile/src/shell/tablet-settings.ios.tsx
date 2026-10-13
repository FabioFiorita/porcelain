import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '../components/ui/box';
import { Item } from '../components/ui/item';
import { Icon } from '../components/ui/icon';
import { Text } from '../components/ui/text';
import { Separator } from '../components/ui/separator';
import { EnvironmentsSettings, useSettingsCategory } from '../features/access';
import { PreferencesScreen } from '../features/preferences';
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

export function TabletSettings() {
  const { category, select } = useSettingsCategory();
  const [width, setWidth] = useState(0);
  const wide = width >= 700;
  const title = categories.find((entry) => entry.id === category)?.title;
  return (
    <Box
      className={wide ? 'flex-1 flex-row' : 'flex-1'}
      surface="background"
      onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}
    >
      <ScrollView
        className={wide ? 'w-56 shrink-0' : 'grow-0'}
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
      <Separator orientation={wide ? 'vertical' : 'horizontal'} />
      <Box className="min-w-0 flex-1">
        <Box paddingX={6} paddingY={2} divider="bottom">
          <Text variant="ui" weight="medium">
            {title}
          </Text>
        </Box>
        <SettingsContent />
      </Box>
    </Box>
  );
}

function SettingsContent() {
  const { category } = useSettingsCategory();
  switch (category) {
    case 'appearance':
      return <PreferencesScreen />;
    case 'environments':
      return <EnvironmentsSettings showHeading={false} />;
    case 'development':
      return __DEV__ ? <ComponentExplorer /> : null;
  }
}
