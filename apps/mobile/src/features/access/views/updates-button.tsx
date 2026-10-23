import { Badge } from '../../../components/ui/badge';
import { Box } from '../../../components/ui/box';

export function UpdatesButton({
  onPress,
  running,
}: {
  onPress: () => void;
  running: boolean;
}) {
  return (
    <Box className="self-center">
      <Badge
        label={running ? 'Updating…' : 'Update'}
        accessibilityLabel="Updates available"
        onPress={onPress}
      />
    </Box>
  );
}
