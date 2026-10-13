import { useState, type ReactNode } from 'react';
import { DeviceType, deviceType } from 'expo-device';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { Box } from '../components/ui/box';
import { Text } from '../components/ui/text';
import { Separator } from '../components/ui/separator';
import { HistoryPane, HistoryPaneContext } from '../features/history';

const StyledSafeAreaView = withUniwind(SafeAreaView);

export function HistoryLayoutFrame({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(0);
  const wide = deviceType === DeviceType.TABLET && width >= 700;
  return (
    <HistoryPaneContext value={wide}>
      <Box
        className="flex-1 flex-row"
        surface="background"
        onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}
      >
        {wide ? (
          <>
            <StyledSafeAreaView
              edges={['top', 'bottom']}
              className="w-72 shrink-0"
            >
              <Box paddingX={4} paddingY={4}>
                <Text variant="heading">History</Text>
              </Box>
              <HistoryPane />
            </StyledSafeAreaView>
            <Separator orientation="vertical" />
          </>
        ) : null}
        <Box className="min-w-0 flex-1">{children}</Box>
      </Box>
    </HistoryPaneContext>
  );
}
