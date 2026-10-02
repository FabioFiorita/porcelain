import {
  Host,
  List,
  NavigationSplitView,
  RNHostView,
  Section,
  Text,
  type NavigationSplitViewColumn,
  type NavigationSplitViewVisibility,
} from '@expo/ui/swift-ui';
import {
  listStyle,
  navigationSplitViewStyle,
  navigationTitle,
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { WorkspaceTabs } from './workspace-tabs';

export function TabletSplit() {
  const [columnVisibility, setColumnVisibility] =
    useState<NavigationSplitViewVisibility>('all');
  const [preferredCompactColumn, setPreferredCompactColumn] =
    useState<NavigationSplitViewColumn>('detail');

  return (
    <Host style={{ flex: 1 }}>
      <NavigationSplitView
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        preferredCompactColumn={preferredCompactColumn}
        onPreferredCompactColumnChange={setPreferredCompactColumn}
        modifiers={[navigationSplitViewStyle('balanced')]}
      >
        <NavigationSplitView.Sidebar>
          <List
            modifiers={[listStyle('sidebar'), navigationTitle('Workspaces')]}
          >
            <Section title="Environments">
              <Text>No environments paired.</Text>
            </Section>
          </List>
        </NavigationSplitView.Sidebar>
        <NavigationSplitView.Detail>
          <RNHostView>
            <WorkspaceTabs />
          </RNHostView>
        </NavigationSplitView.Detail>
      </NavigationSplitView>
    </Host>
  );
}
