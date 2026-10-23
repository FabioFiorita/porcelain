import { RNHostView } from '@expo/ui';
import { ScrollView } from 'react-native';
import type { Remote } from '@porcelain/client/access/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Item } from '../../../components/ui/item';
import { Text } from '../../../components/ui/text';

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
            <Text variant="heading">This computer</Text>
            <Text variant="ui" weight="medium">
              {remote.name}
            </Text>
            <Text variant="caption" tone="muted">
              {remote.address}
            </Text>
          </Box>
          <Box gap={3}>
            <Text variant="subheading" tone="muted">
              Devices
            </Text>
            <Card>
              <Item
                title="Paired devices"
                description="View and manage paired devices in Settings → Computers → This computer in a browser on the computer that runs Porcelain."
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
                description="Create a pairing link in Settings → Computers → This computer in a browser on the computer that runs Porcelain. Open the link on the other device to connect it to this computer."
              />
            </Card>
          </Box>
          <Button label="Close" variant="ghost" onPress={onClose} />
        </Box>
      </ScrollView>
    </RNHostView>
  );
}
