import { useAtom, useAtomValue } from '@effect/atom-react';
import {
  runSettingsUpdates,
  settingsUpdateBatch,
  settingsUpdateBatchProgress,
  settingsUpdateCount,
} from '@porcelain/client/access';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Text } from '../../../components/ui/text';
import { useServiceUpdates } from '../queries/service-updates';

export function ComputerUpdatesSummary() {
  const { targets } = useServiceUpdates();
  const batch = useAtomValue(settingsUpdateBatch);
  const [, run] = useAtom(runSettingsUpdates);
  const count = settingsUpdateCount(targets);
  const progress = settingsUpdateBatchProgress(batch);
  const progressLabel = progress.label ? `${progress.label}…` : 'Updating…';
  if (!targets.some((target) => target.state.available) && !batch.running)
    return null;
  return (
    <Card padding={4} gap={3}>
      <Box gap={1}>
        <Text variant="subheading">Updates available</Text>
        <Text variant="caption" tone="muted">
          Only computers that allow this device to update are included.
        </Text>
      </Box>
      <Button
        label={batch.running ? progressLabel : `Update all (${count})`}
        disabled={batch.running || count === 0}
        onPress={() => run(targets)}
      />
    </Card>
  );
}
