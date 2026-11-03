import { Stack } from 'expo-router';
import { Box } from '../../../components/ui/box';
import { Card } from '../../../components/ui/card';
import { Empty } from '../../../components/ui/empty';
import { Item } from '../../../components/ui/item';
import { Screen } from '../../../components/ui/screen';
import { Text } from '../../../components/ui/text';
import { useEnvironments } from '../store';
import { ComputerWaysIn } from './computer-ways-in';

export function ComputerScreen({
  environmentId,
}: {
  environmentId: string | undefined;
}) {
  const remote = useEnvironments().find(
    (entry) => entry.environmentId === environmentId,
  );
  if (!remote)
    return (
      <Screen layout="fixed">
        <Empty
          title="Computer unavailable"
          description="This computer is no longer paired. Return to Computers."
        />
      </Screen>
    );
  return (
    <Screen layout="scroll">
      <Stack.Screen options={{ title: remote.name }} />
      <Box gap={6} paddingX={6} paddingY={8}>
        <Text variant="caption" tone="muted" selectable>
          {remote.address}
        </Text>
        <ComputerWaysIn environmentId={remote.environmentId} />
        <Box gap={3}>
          <Text variant="headline" tone="muted">
            Devices
          </Text>
          <Card>
            <Item
              title="Paired devices"
              description="Manage devices from Computers on a computer with sharing access."
            />
          </Card>
        </Box>
        <Box gap={3}>
          <Text variant="headline" tone="muted">
            Pair a device
          </Text>
          <Card>
            <Item
              title="Pair a device"
              description="Create a link from Computers on a device with sharing access, then open it on the device you want to pair."
            />
          </Card>
        </Box>
      </Box>
    </Screen>
  );
}
