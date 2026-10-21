import { useAtom, useAtomValue } from '@effect/atom-react';
import {
  runSettingsUpdates,
  settingsUpdateBatch,
  settingsUpdateBatchProgress,
  settingsUpdateCount,
} from '@porcelain/client/access';
import { Button } from '../../../components/ui/button';
import { useServiceUpdates } from '../queries/service-updates';

export function UpdateAllButton() {
  const { targets } = useServiceUpdates();
  const batch = useAtomValue(settingsUpdateBatch);
  const [, run] = useAtom(runSettingsUpdates);
  const count = settingsUpdateCount(targets);
  const progress = settingsUpdateBatchProgress(batch);
  const progressLabel = progress.label ? `${progress.label}…` : 'Updating…';
  return (
    <Button
      label={batch.running ? progressLabel : `Update all (${count})`}
      disabled={batch.running || count === 0}
      onPress={() => run(targets)}
    />
  );
}
