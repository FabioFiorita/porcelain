import { DevelopmentCredentials } from './development-credentials';
import { Box } from '../../../components/ui/box';
import { Card } from '../../../components/ui/card';
import { GroupHeader } from '../../../components/ui/group-header';
import { Item } from '../../../components/ui/item';

export default function DevelopmentSettingsSection({
  onOpenComponentLibrary,
}: {
  onOpenComponentLibrary: () => void;
}) {
  return (
    <Box gap={3}>
      <Box>
        <GroupHeader variant="section" label="Development" />
        <Card>
          <Item
            title="Component library"
            description="Preview Porcelain’s controls and native components."
            onPress={onOpenComponentLibrary}
          />
        </Card>
      </Box>
      <DevelopmentCredentials />
    </Box>
  );
}
