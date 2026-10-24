import { reducedMotion } from '../shared/adapters/accessibility';
import { useAtomMount, useAtomValue } from '@effect/atom-react';
import { Slot } from 'expo-router';
import { useState } from 'react';
import { Dimensions, useWindowDimensions } from 'react-native';
import { Box } from '../components/ui/box';
import { SidebarPane } from '../components/ui/sidebar-pane';
import { useAppSidebar, tabletSidebar } from '../features/preferences';
import { TabletSidebar } from './tablet-sidebar';

export function TabletLayout() {
  const reduceMotion = useAtomValue(reducedMotion);
  const { sidebar } = useAppSidebar();
  const sidebarVisible = sidebar?.visible ?? true;
  const [width, setWidth] = useState(0);
  const compact = width > 0 && width < 700;
  const window = useWindowDimensions();
  const screen = Dimensions.get('screen');
  const windowed = window.width < screen.width || window.height < screen.height;
  useAtomMount(tabletSidebar);
  return (
    <Box
      className="flex-1 flex-row"
      surface="sidebar"
      onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}
    >
      <SidebarPane
        visible={sidebarVisible}
        compact={compact}
        reduceMotion={reduceMotion}
      >
        <TabletSidebar windowed={windowed} />
      </SidebarPane>
      <Box className="min-w-0 flex-1">
        <Slot />
      </Box>
    </Box>
  );
}
