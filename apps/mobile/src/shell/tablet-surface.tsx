import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { Box } from '../components/ui/box';

const StyledSafeAreaView = withUniwind(SafeAreaView);

export function TabletSurface({ children }: { children: ReactNode }) {
  return (
    <StyledSafeAreaView
      edges={['top', 'left', 'right']}
      className="min-w-0 flex-1 bg-sidebar"
    >
      <Box className="min-w-0 flex-1" padding={2}>
        {children}
      </Box>
    </StyledSafeAreaView>
  );
}
