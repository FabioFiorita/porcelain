import { Badge } from '../../../components/ui/badge';

export function UpdatesButton({
  onPress,
  running,
}: {
  onPress: () => void;
  running: boolean;
}) {
  return (
    <Badge
      label={running ? 'Updating…' : 'Update'}
      accessibilityLabel="Updates available"
      onPress={onPress}
    />
  );
}
