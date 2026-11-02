import { RNHostView } from '@expo/ui';
import { ScrollView } from 'react-native';
import type { Remote } from '@porcelain/client/access/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Item } from '../../../components/ui/item';
import { Text } from '../../../components/ui/text';
import { ComputerWaysIn } from './computer-ways-in';

export function ThisComputer({
  remote,
  onClose,
}: {
  remote: Remote;
  onClose: () => void;
}) {
  return (
    <RNHostView>
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Box gap={6} paddingX={6} paddingY={8}>
          <Box gap={2}>
            <Text variant="heading">{remote.name}</Text>
            <Text variant="caption" tone="muted">
              {remote.address}
            </Text>
          </Box>
          <ComputerWaysIn environmentId={remote.environmentId} />
          <Box gap={3}>
            <Text variant="subheading" tone="muted">
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
            <Text variant="subheading" tone="muted">
              Pair a device
            </Text>
            <Card>
              <Item
                title="Pair a device"
                description="Create a link from Computers on a device with sharing access, then open it on the device you want to pair."
              />
            </Card>
          </Box>
          <Button label="Close" variant="ghost" onPress={onClose} />
        </Box>
      </ScrollView>
    </RNHostView>
  );
}
