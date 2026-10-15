import { Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, useWindowDimensions } from 'react-native';
import { Box } from '../components/ui/box';
import { SidebarPane } from '../components/ui/sidebar-pane';
import { useAppSidebar } from '../features/preferences';
import { TabletSidebar } from './tablet-sidebar';

export function TabletLayout() {
  const { sidebar, setSidebarVisible } = useAppSidebar();
  const sidebarVisible = sidebar?.visible ?? true;
  const [width, setWidth] = useState(0);
  const compact = width > 0 && width < 700;
  const window = useWindowDimensions();
  const screen = Dimensions.get('screen');
  const windowed = window.width < screen.width || window.height < screen.height;
  useEffect(() => {
    setSidebarVisible(true);
  }, [setSidebarVisible]);
  useEffect(
    () => () => {
      setSidebarVisible(undefined);
    },
    [setSidebarVisible],
  );
  return (
    <Box
      className="flex-1 flex-row"
      surface="background"
      onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}
    >
      <SidebarPane visible={sidebarVisible} compact={compact}>
        <TabletSidebar windowed={windowed} />
      </SidebarPane>
      <Box className="min-w-0 flex-1">
        <Slot />
      </Box>
    </Box>
  );
}
