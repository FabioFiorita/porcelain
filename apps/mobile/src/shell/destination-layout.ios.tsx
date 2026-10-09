import { Stack } from 'expo-router';
import { DeviceType, deviceType } from 'expo-device';
import type { ReactNode } from 'react';

export function DestinationLayout({
  name,
  title,
  children,
}: {
  name: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Stack
      screenOptions={
        deviceType === DeviceType.TABLET
          ? { headerShown: false }
          : { headerBackButtonDisplayMode: 'minimal' }
      }
    >
      <Stack.Screen name={name} options={{ title }} />
      {children}
    </Stack>
  );
}
