import { osName } from 'expo-device';
import { mobileVersion } from '../../../shared/adapters/app-version';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';

export function SettingsAbout() {
  return (
    <Box padding={4}>
      <Text variant="caption" tone="muted" className="text-center">
        Porcelain for {osName ?? 'mobile'} {mobileVersion}
      </Text>
    </Box>
  );
}
