import { Stack } from 'expo-router';

function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
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
    </Stack>
  );
}

export { SettingsLayout as default };
