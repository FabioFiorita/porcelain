import { DevelopmentCredentials } from './development-credentials';
import { Box } from '../../../components/ui/box';
import { Item } from '../../../components/ui/item';
import { Text } from '../../../components/ui/text';

export function DevelopmentSettingsSection({
  onOpenComponentLibrary,
}: {
  onOpenComponentLibrary: () => void;
}) {
  return (
    <Box gap={3}>
      <Text variant="subheading" tone="muted">
        Development
      </Text>
      <Item
        title="Component library"
        description="Preview Porcelain’s controls and native components."
        variant="outline"
        onPress={onOpenComponentLibrary}
      />
      <DevelopmentCredentials />
    </Box>
  );
}
