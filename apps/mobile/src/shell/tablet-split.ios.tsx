import { Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import {
  Host,
  NavigationSplitView,
  RNHostView,
  type NavigationSplitViewColumn,
  type NavigationSplitViewVisibility,
} from '@expo/ui/swift-ui';
import { TabletSidebar } from './tablet-sidebar';
import { TabletContents } from './tablet-contents';

export function TabletSplit() {
  const { width, height } = useWindowDimensions();
  const [visibility, setVisibility] = useState<NavigationSplitViewVisibility>(
    width >= height ? 'all' : 'doubleColumn',
  );
  const [compactColumn, setCompactColumn] =
    useState<NavigationSplitViewColumn>('detail');
  useEffect(() => {
    setVisibility(width >= height ? 'all' : 'doubleColumn');
  }, [width, height]);
  return (
    <Host style={{ flex: 1 }}>
      <NavigationSplitView
        preferredCompactColumn={compactColumn}
        onPreferredCompactColumnChange={setCompactColumn}
        columnVisibility={visibility}
        onColumnVisibilityChange={setVisibility}
      >
        <NavigationSplitView.Sidebar>
          <TabletSidebar
            onNavigate={() => {
              if (width < height) setVisibility('doubleColumn');
            }}
          />
        </NavigationSplitView.Sidebar>
        <NavigationSplitView.Content>
          <TabletContents />
        </NavigationSplitView.Content>
        <NavigationSplitView.Detail>
          <RNHostView>
            <View style={{ flex: 1 }}>
              <Slot />
            </View>
          </RNHostView>
        </NavigationSplitView.Detail>
      </NavigationSplitView>
    </Host>
  );
}
