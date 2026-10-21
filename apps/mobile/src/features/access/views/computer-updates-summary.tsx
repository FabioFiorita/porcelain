import { Box } from '../../../components/ui/box';
import { Card } from '../../../components/ui/card';
import { Text } from '../../../components/ui/text';
import { useUpdatesIndicator } from '../queries/service-updates';
import { UpdateAllButton } from './update-all-button';

export function ComputerUpdatesSummary() {
  const { visible } = useUpdatesIndicator();
  if (!visible) return null;
  return (
    <Card padding={4} gap={3}>
      <Box gap={1}>
        <Text variant="subheading">Updates available</Text>
        <Text variant="caption" tone="muted">
          Only computers that allow this device to update are included.
        </Text>
      </Box>
      <UpdateAllButton />
    </Card>
  );
}
