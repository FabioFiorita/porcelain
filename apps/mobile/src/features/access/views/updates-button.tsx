import { ButtonSurface } from '../../../components/ui/button-surface';
import { Text } from '../../../components/ui/text';

export function UpdatesButton({
  onPress,
  running,
}: {
  onPress: () => void;
  running: boolean;
}) {
  return (
    <ButtonSurface
      accessibilityLabel="Updates available"
      size="sm"
      shape="pill"
      onPress={onPress}
    >
      <Text variant="caption" tone="primaryForeground" weight="medium">
        {running ? 'Updating…' : 'Update'}
      </Text>
    </ButtonSurface>
  );
}
