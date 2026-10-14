import { ScrollView } from 'react-native';
import { Box } from '../../../components/ui/box';
import { Item } from '../../../components/ui/item';
import { Text } from '../../../components/ui/text';
import { DevelopmentSettingsSection } from './development-settings';
import { EnvironmentSettingsSection } from './environments-settings';

export function SettingsScreen({
  onOpenAppearance,
  onOpenComponentLibrary,
}: {
  onOpenAppearance?: () => void;
  onOpenComponentLibrary?: () => void;
}) {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Box
        className="w-full max-w-2xl self-center"
        gap={6}
        paddingX={4}
        paddingY={4}
        paddingBottom={8}
      >
        {onOpenAppearance ? (
          <Box gap={3}>
            <Text variant="subheading" tone="muted">
              Appearance
            </Text>
            <Item
              title="Theme, code and documents"
              description="Choose how Porcelain looks and displays files."
              variant="outline"
              onPress={onOpenAppearance}
            />
          </Box>
        ) : null}
        <EnvironmentSettingsSection />
        {__DEV__ && onOpenComponentLibrary ? (
          <DevelopmentSettingsSection
            onOpenComponentLibrary={onOpenComponentLibrary}
          />
        ) : null}
      </Box>
    </ScrollView>
  );
}
