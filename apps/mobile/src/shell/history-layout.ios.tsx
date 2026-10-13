import { useEffect, type ReactNode } from 'react';
import { DeviceType, deviceType } from 'expo-device';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { Box } from '../components/ui/box';
import { Separator } from '../components/ui/separator';
import { HistoryPane, useHistoryPresentation } from '../features/history';
import { useAppSidebar } from '../features/preferences';
import { PaneHeading } from './pane-heading';

const StyledSafeAreaView = withUniwind(SafeAreaView);

export function HistoryLayoutFrame({ children }: { children: ReactNode }) {
  const { wide, setWide } = useHistoryPresentation();
  const { sidebar } = useAppSidebar();
  useEffect(() => () => setWide(false), [setWide]);
  return (
    <Box
      className="flex-1 flex-row"
      surface="background"
      onLayout={({ nativeEvent: { layout } }) =>
        setWide(deviceType === DeviceType.TABLET && layout.width >= 700)
      }
    >
      {wide ? (
        <>
          <StyledSafeAreaView
            edges={['top', 'bottom']}
            className="w-72 shrink-0"
          >
            <PaneHeading title="History" sidebar={sidebar} />
            <HistoryPane />
          </StyledSafeAreaView>
          <Separator orientation="vertical" />
        </>
      ) : null}
      <Box className="min-w-0 flex-1">{children}</Box>
    </Box>
  );
}
