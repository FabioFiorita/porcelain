import { DevelopmentCredentials } from './development-credentials';
import { Box } from '../../../components/ui/box';
import { Item } from '../../../components/ui/item';
import { Text } from '../../../components/ui/text';

export default function DevelopmentSettingsSection({
  onOpenComponentLibrary,
}: {
  onOpenComponentLibrary: () => void;
}) {
  return (
    <Box gap={3}>
      <Text variant="headline" tone="muted">
        Development
      </Text>
      <Item
        title="Component library"
        description="Preview Porcelain’s controls and native components."
        onPress={onOpenComponentLibrary}
      />
      <DevelopmentCredentials />
    </Box>
  );
}
