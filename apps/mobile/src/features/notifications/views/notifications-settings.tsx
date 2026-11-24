import { ScrollView } from 'react-native';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';

export function NotificationsSettings() {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Box className="w-full max-w-2xl self-center" padding={4}>
        <Text tone="muted">
          Porcelain currently sends no push notifications.
        </Text>
      </Box>
    </ScrollView>
  );
}
