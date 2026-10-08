import { Stack } from 'expo-router';
import { DestinationLayout } from '../../shell/destination-layout';

function SettingsLayout() {
  return (
    <DestinationLayout name="settings" title="Settings">
      <Stack.Protected guard={__DEV__}>
        <Stack.Screen
          name="component-library"
          options={{ title: 'Component library' }}
        />
        <Stack.Screen name="component-text" options={{ title: 'Text' }} />
        <Stack.Screen name="component-button" options={{ title: 'Button' }} />
        <Stack.Screen
          name="component-preview"
          options={{ title: 'Primitives' }}
        />
      </Stack.Protected>
    </DestinationLayout>
  );
}

export { SettingsLayout as default };
