import { Stack } from 'expo-router';
import { sheetOptions } from '../../components/ui/sheet';

export const unstable_settings = { anchor: 'settings' };

function SettingsLayout() {
  return (
    <Stack
      screenOptions={({ theme }) => ({
        headerBackButtonDisplayMode: 'minimal',
        headerLargeTitleEnabled: false,
        headerTintColor: theme.colors.text,
      })}
    >
      <Stack.Screen
        name="settings"
        options={{ title: 'Settings', headerLargeTitleEnabled: true }}
      />
      <Stack.Screen name="general" options={{ title: 'General' }} />
      <Stack.Screen name="reviews-git" options={{ title: 'Reviews & Git' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="computers" options={{ title: 'Computers' }} />
      <Stack.Screen name="computer" options={{ title: 'Computer' }} />
      <Stack.Screen
        name="pair-computer"
        options={{ title: 'Pair a computer', ...sheetOptions('half') }}
      />
      <Stack.Screen name="open/pair" options={{ animation: 'none' }} />
      <Stack.Screen
        name="scan-pairing-link"
        options={{
          title: 'Scan QR code',
          presentation: 'fullScreenModal',
          headerShown: false,
        }}
      />
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
