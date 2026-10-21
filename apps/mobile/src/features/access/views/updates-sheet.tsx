import { BottomSheet, RNHostView } from '@expo/ui';
import { ScrollView } from 'react-native';
import { useAtomValue } from '@effect/atom-react';
import { settingsUpdateBatch } from '@porcelain/client/access';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Item } from '../../../components/ui/item';
import { Text } from '../../../components/ui/text';
import { useServiceUpdates } from '../queries/service-updates';
import { ComputerUpdate } from './computer-update';
import { UpdateAllButton } from './update-all-button';

export function UpdatesSheet({
  presented,
  onClose,
  onManageComputers,
}: {
  presented: boolean;
  onClose: () => void;
  onManageComputers: () => void;
}) {
  return (
    <BottomSheet
      isPresented={presented}
      onDismiss={onClose}
      contentPadding={0}
      snapPoints={['half', 'full']}
    >
      {presented ? (
        <UpdatesContent
          onManageComputers={onManageComputers}
          onClose={onClose}
        />
      ) : null}
    </BottomSheet>
  );
}

function UpdatesContent({
  onManageComputers,
  onClose,
}: {
  onManageComputers: () => void;
  onClose: () => void;
}) {
  const { rows } = useServiceUpdates();
  const batch = useAtomValue(settingsUpdateBatch);
  const offers = rows.filter(
    (row) =>
      (row.target &&
        (row.target.state.available || !row.target.state.managed)) ||
      batch.entries.some((entry) => entry.id === row.remote.environmentId),
  );
  return (
    <RNHostView>
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Box gap={4} paddingX={6} paddingY={8}>
          <Text variant="heading">Updates available</Text>
          <Text variant="caption" tone="muted">
            Update Porcelain on your connected computers. The Mac app updates
            itself on the Mac.
          </Text>
          {offers.map((row) => (
            <Card key={row.remote.environmentId}>
              <Item title={row.remote.name}>
                <ComputerUpdate environmentId={row.remote.environmentId} />
              </Item>
            </Card>
          ))}
          {offers.length === 0 ? (
            <Text variant="ui" tone="muted">
              No updates available.
            </Text>
          ) : null}
          {batch.entries
            .filter(
              (entry) =>
                !rows.some((row) => row.remote.environmentId === entry.id),
            )
            .map((entry) => (
              <Text
                key={entry.id}
                variant="caption"
                tone={entry.status === 'failed' ? 'destructive' : 'muted'}
              >
                {entry.name}:{' '}
                {entry.status === 'failed' ? entry.message : entry.status}
              </Text>
            ))}
          <UpdateAllButton />
          <Button
            label="Manage computers"
            variant="ghost"
            onPress={() => {
              onClose();
              onManageComputers();
            }}
          />
          <Button label="Close" variant="ghost" onPress={onClose} />
        </Box>
      </ScrollView>
    </RNHostView>
  );
}
