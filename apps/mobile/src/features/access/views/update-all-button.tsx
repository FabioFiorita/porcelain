import { useAtom, useAtomValue } from '@effect/atom-react';
import {
  runSettingsUpdates,
  settingsUpdateBatch,
  settingsUpdateBatchProgress,
  settingsUpdateCount,
} from '@porcelain/client/access';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { useServiceUpdates } from '../queries/service-updates';

export function UpdateAllButton() {
  const { targets } = useServiceUpdates();
  const batch = useAtomValue(settingsUpdateBatch);
  const [, run] = useAtom(runSettingsUpdates);
  const count = settingsUpdateCount(targets);
  const progress = settingsUpdateBatchProgress(batch);
  const progressLabel = progress.label ? `${progress.label}…` : 'Updating…';
  return (
    <Item
      title={batch.running ? progressLabel : `Update all (${count})`}
      leading={<Icon name="refresh" tone={count === 0 ? 'muted' : 'brand'} />}
      disabled={batch.running || count === 0}
      onPress={() => run(targets)}
    />
  );
}
