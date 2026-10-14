import { Stack } from 'expo-router';
import { SettingsNavigator } from '../../shell/settings-presentation';

export const unstable_settings = { anchor: 'settings' };

function SettingsLayout() {
  return (
    <SettingsNavigator>
      <Stack.Screen name="appearance" options={{ title: 'Appearance' }} />
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
    </SettingsNavigator>
  );
}

export { SettingsLayout as default };
