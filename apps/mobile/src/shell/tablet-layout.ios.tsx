import { reducedMotion } from '../shared/adapters/accessibility';
import { useAtomMount, useAtomValue } from '@effect/atom-react';
import { Slot, usePathname } from 'expo-router';
import { useState } from 'react';
import { Box } from '../components/ui/box';
import { SidebarPane } from '../components/ui/sidebar-pane';
import { useAppSidebar, tabletSidebar } from '../features/preferences';
import { TabletSidebar } from './tablet-sidebar';
import { destinationForPath } from './destinations';

export function TabletLayout() {
  const reduceMotion = useAtomValue(reducedMotion);
  const { sidebar } = useAppSidebar();
  const inSettings = destinationForPath(usePathname()).group === '(settings)';
  const sidebarVisible = !inSettings && (sidebar?.visible ?? true);
  const [width, setWidth] = useState(0);
  const compact = width > 0 && width < 700;
  useAtomMount(tabletSidebar);
  return (
    <Box
      className="flex-1 flex-row"
      surface="sidebar"
      onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}
    >
      {!inSettings ? (
        <SidebarPane
          visible={sidebarVisible}
          compact={compact}
          reduceMotion={reduceMotion}
        >
          <TabletSidebar />
        </SidebarPane>
      ) : null}
      <Box className="min-w-0 flex-1">
        <Slot />
      </Box>
    </Box>
  );
}
