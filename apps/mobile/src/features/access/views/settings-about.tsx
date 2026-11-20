import { osName } from 'expo-device';
import { mobileVersion } from '../../../shared/adapters/app-version';
import { usePreviewLink } from '../../../shared/adapters/preview-link';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { Text } from '../../../components/ui/text';

export function SettingsAbout() {
  const privacy = usePreviewLink();
  return (
    <Box padding={4} gap={2}>
      <Text variant="caption" tone="muted" className="text-center">
        Porcelain for {osName ?? 'mobile'} {mobileVersion}
      </Text>
      <Button
        testID="settings-privacy-policy"
        label="Privacy policy"
        variant="plain"
        onPress={() =>
          privacy.open('https://porcelain.fabiofiorita.com/privacy/')
        }
      />
      {privacy.error ? <ErrorState message={privacy.error} /> : null}
    </Box>
  );
}
