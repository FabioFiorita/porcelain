import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import {
  useServiceUpdates,
  useUpdatesIndicator,
} from '../queries/service-updates';
import { UpdateAllButton } from './update-all-button';

export function ComputerUpdatesSummary() {
  const { running } = useUpdatesIndicator();
  const { checking, refresh } = useServiceUpdates();
  return (
    <Box className="flex-row flex-wrap justify-end" gap={2}>
      <Button
        variant="tonal"
        label="Check for updates"
        pending={checking}
        disabled={running || checking}
        onPress={refresh}
      />
      <UpdateAllButton />
    </Box>
  );
}
