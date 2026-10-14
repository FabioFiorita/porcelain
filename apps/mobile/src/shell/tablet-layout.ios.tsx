import { Slot, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Box } from '../components/ui/box';
import { Separator } from '../components/ui/separator';
import { useAppSidebar } from '../features/preferences';
import { TabletSidebar } from './tablet-sidebar';
import { destinationForPath } from './destinations';

export function TabletLayout() {
  const inSettings = destinationForPath(usePathname()).group === '(settings)';
  const { sidebar, setSidebarVisible } = useAppSidebar();
  const sidebarVisible = sidebar?.visible ?? !inSettings;
  const [width, setWidth] = useState(0);
  const compact = width > 0 && width < 700;
  useEffect(() => {
    setSidebarVisible(!inSettings);
  }, [inSettings, setSidebarVisible]);
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
      {sidebarVisible ? (
        <>
          <Box className={compact ? 'flex-1' : 'w-64 shrink-0'}>
            <TabletSidebar
              onNavigate={() => {
                if (compact) setSidebarVisible(false);
              }}
              {...(compact ? { onClose: () => setSidebarVisible(false) } : {})}
            />
          </Box>
          <Separator orientation="vertical" />
        </>
      ) : null}
      <Box className={compact && sidebarVisible ? 'hidden' : 'min-w-0 flex-1'}>
        <Slot />
      </Box>
    </Box>
  );
}
