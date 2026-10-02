import { Slot } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Host,
  NavigationSplitView,
  RNHostView,
  Toolbar,
  ToolbarItem,
  type NavigationSplitViewColumn,
  type NavigationSplitViewVisibility,
} from '@expo/ui/swift-ui';
import { TabletSidebar } from './tablet-sidebar';
import { TabletContents } from './tablet-contents';
import { WorkspacePicker } from '../features/projects';

export function TabletSplit() {
  const [layout, setLayout] = useState<{
    landscape: boolean | undefined;
    visibility: NavigationSplitViewVisibility;
  }>({ landscape: undefined, visibility: 'all' });
  const [compactColumn, setCompactColumn] =
    useState<NavigationSplitViewColumn>('detail');
  return (
    <Host
      style={{ flex: 1 }}
      onLayoutContent={({ nativeEvent: { width, height } }) => {
        if (width === 0 || height === 0) return;
        const landscape = width >= height;
        setLayout((previous) =>
          previous.landscape === landscape
            ? previous
            : {
                landscape,
                visibility: landscape ? 'all' : 'doubleColumn',
              },
        );
      }}
    >
      <NavigationSplitView
        preferredCompactColumn={compactColumn}
        onPreferredCompactColumnChange={setCompactColumn}
        columnVisibility={layout.visibility}
        onColumnVisibilityChange={(visibility) =>
          setLayout((previous) => ({ ...previous, visibility }))
        }
      >
        <NavigationSplitView.Sidebar>
          <TabletSidebar
            onNavigate={() => {
              setLayout((previous) =>
                previous.landscape === false
                  ? { ...previous, visibility: 'doubleColumn' }
                  : previous,
              );
            }}
          />
        </NavigationSplitView.Sidebar>
        <NavigationSplitView.Content>
          <TabletContents />
        </NavigationSplitView.Content>
        <NavigationSplitView.Detail>
          <Toolbar>
            <RNHostView>
              <View style={{ flex: 1 }}>
                <Slot />
              </View>
            </RNHostView>
            <Toolbar.Content>
              <ToolbarItem placement="topBarTrailing">
                <WorkspacePicker presentation="tablet" />
              </ToolbarItem>
            </Toolbar.Content>
          </Toolbar>
        </NavigationSplitView.Detail>
      </NavigationSplitView>
    </Host>
  );
}
