import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-screens/experimental';
import { Box } from '../../../components/ui/box';

export function ReviewBottomBar({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView
      edges={{ bottom: true }}
      insetType="system"
      style={{ flex: 0 }}
    >
      <Box paddingX={4} paddingY={3} gap={2} surface="background">
        {children}
      </Box>
    </SafeAreaView>
  );
}
