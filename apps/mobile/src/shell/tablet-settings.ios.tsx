import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { Box } from '../components/ui/box';
import { Item } from '../components/ui/item';
import { Icon } from '../components/ui/icon';
import { Separator } from '../components/ui/separator';
import { EnvironmentsSettings, useSettingsCategory } from '../features/access';
import { PreferencesScreen, useAppSidebar } from '../features/preferences';
import { ComponentExplorer } from '../features/catalog';
import { DestinationLayout } from './destination-layout';
import { PaneHeading } from './pane-heading';

const StyledSafeAreaView = withUniwind(SafeAreaView);
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

export function TabletSettingsLayout({ children }: { children: ReactNode }) {
  const { category, select } = useSettingsCategory();
  const { sidebar } = useAppSidebar();
  useEffect(() => {
    select('appearance');
  }, [select]);
  const [width, setWidth] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const wide = width >= 700;
  const selected = pathname.startsWith('/component-')
    ? 'development'
    : category;
  const title =
    categories.find((entry) => entry.id === category)?.title ?? 'Appearance';
  return (
    <Box
      className={wide ? 'flex-1 flex-row' : 'flex-1'}
      surface="background"
      onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}
    >
      <StyledSafeAreaView
        edges={['top', 'bottom']}
        className={wide ? 'w-56 shrink-0' : 'grow-0'}
      >
        <PaneHeading title="Settings" sidebar={sidebar} />
        <ScrollView
          className={wide ? 'flex-1' : ''}
          horizontal={!wide}
          showsHorizontalScrollIndicator={false}
        >
          <Box
            className={wide ? '' : 'flex-row'}
            gap={1}
            paddingX={4}
            paddingBottom={8}
          >
            {categories
              .filter((entry) => entry.id !== 'development' || __DEV__)
              .map((entry) => (
                <Item
                  key={entry.id}
                  title={entry.title}
                  leading={<Icon name={entry.icon} />}
                  size="sm"
                  testID={entry.testID}
                  selected={entry.id === selected}
                  onPress={() => {
                    select(entry.id);
                    if (pathname !== '/settings') router.dismissTo('/settings');
                  }}
                />
              ))}
          </Box>
        </ScrollView>
      </StyledSafeAreaView>
      <Separator orientation={wide ? 'vertical' : 'horizontal'} />
      <Box className="min-w-0 flex-1">
        <DestinationLayout name="settings" title={title}>
          {children}
        </DestinationLayout>
      </Box>
    </Box>
  );
}

export function TabletSettings() {
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
