import { useAtomValue } from '@effect/atom-react';
import { settingsUpdateBatch } from '@porcelain/client/access';
import { ButtonSurface } from '../../../components/ui/button-surface';
import { Text } from '../../../components/ui/text';
import { useServiceUpdates } from '../queries/service-updates';

export function UpdatesButton({ onPress }: { onPress: () => void }) {
  const { targets } = useServiceUpdates();
  const batch = useAtomValue(settingsUpdateBatch);
  const available = targets.some((target) => target.state.available);
  if (!available && !batch.running && batch.entries.length === 0) return null;
  return (
    <ButtonSurface
      accessibilityLabel="Updates available"
      size="sm"

      onPress={onPress}
    >
      <Text variant="caption" tone="primaryForeground" weight="medium">
        Update
      </Text>
    </ButtonSurface>
  );
}
