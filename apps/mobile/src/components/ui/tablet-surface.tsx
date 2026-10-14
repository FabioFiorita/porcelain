import type { ReactNode } from 'react';
import { Dimensions, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { Box } from './box';

const StyledSafeAreaView = withUniwind(SafeAreaView);

export function TabletSurface({ children }: { children: ReactNode }) {
  const window = useWindowDimensions();
  const screen = Dimensions.get('screen');
  const windowed = window.width < screen.width || window.height < screen.height;
  return (
    <StyledSafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      className="min-w-0 flex-1 bg-background"
    >
      <Box className="min-w-0 flex-1" {...(windowed ? { paddingTop: 8 } : {})}>
        {children}
      </Box>
    </StyledSafeAreaView>
  );
}
