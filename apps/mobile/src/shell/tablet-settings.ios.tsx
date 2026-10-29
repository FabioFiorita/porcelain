import { lazy, Suspense, useState } from 'react';
import { ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { TabletSurface } from './tablet-surface';
import { Box } from '../components/ui/box';
import { Button } from '../components/ui/button';
import { Item } from '../components/ui/item';
import { Icon } from '../components/ui/icon';
import { Separator } from '../components/ui/separator';
import { Text } from '../components/ui/text';
import {
  EnvironmentsSettings,
  useSettingsCategory,
  SettingsAbout,
  SettingsCategories,
} from '../features/access';
import { PreferencesScreen, ReviewsGitSettings } from '../features/preferences';
const ComponentExplorer = __DEV__
  ? lazy(() => import('../features/development-catalog'))
  : () => null;

const categories = [
  { id: 'general', title: 'General' },
  {
    id: 'reviews-git',
    title: 'Reviews & Git',
  },
  {
    id: 'computers',
    title: 'Computers',
  },
  {
    id: 'development',
    title: 'Development',
  },
] as const;

export function TabletSettings() {
  const { category, select } = useSettingsCategory();
  const router = useRouter();
  const [width, setWidth] = useState(0);
  const wide = width >= 700;
  return (
    <TabletSurface>
      <Stack.Screen options={{ headerShown: false }} />
      <Box className="min-w-0 flex-1" surface="panel">
        <Box
          className="h-13 flex-row items-center justify-between"
          paddingX={4}
          divider="bottom"
        >
          <Box className="min-w-0 flex-1 flex-row items-center" gap={2}>
            <Text variant="ui" tone="muted">
              Settings
            </Text>
            <Text variant="ui" tone="muted">
              /
            </Text>
            <Text variant="ui" weight="medium">
              {categories.find((entry) => entry.id === category)?.title}
            </Text>
          </Box>
          <Button
            label="Close"
            variant="ghost"
            accessibilityLabel="Close Settings"
            onPress={() => router.replace('/files')}
          />
        </Box>
        <Box
          className={wide ? 'min-w-0 flex-1 flex-row' : 'min-w-0 flex-1'}
          onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}
        >
          <Box className={wide ? 'w-74 shrink-0' : 'h-64 shrink-0'}>
            <ScrollView className="flex-1">
              <Box gap={3} padding={4}>
                <SettingsCategories
                  category={category}
                  onOpenGeneral={() => select('general')}
                  onOpenReviewsGit={() => select('reviews-git')}
                  onOpenComputers={() => select('computers')}
                />
                {__DEV__ ? (
                  <Item
                    title="Development"
                    accessibilityLabel="Development"
                    leading={
                      <Box
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      >
                        <Icon name="code" />
                      </Box>
                    }
                    testID="settings-development"
                    selected={category === 'development'}
                    onPress={() => select('development')}
                  />
                ) : null}
              </Box>
            </ScrollView>
            <SettingsAbout />
          </Box>
          <Separator orientation={wide ? 'vertical' : 'horizontal'} />
          <Box className="min-w-0 flex-1">
            <SettingsContent />
          </Box>
        </Box>
      </Box>
    </TabletSurface>
  );
}

function SettingsContent() {
  const { category } = useSettingsCategory();
  switch (category) {
    case 'general':
      return <PreferencesScreen inline />;
    case 'reviews-git':
      return <ReviewsGitSettings />;
    case 'computers':
      return <EnvironmentsSettings inlinePairing />;
    case 'development':
      return __DEV__ ? (
        <Suspense fallback={null}>
          <ComponentExplorer />
        </Suspense>
      ) : null;
  }
}
