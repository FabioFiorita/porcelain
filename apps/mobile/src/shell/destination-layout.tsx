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
      screenOptions={({ theme }) => ({
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: theme.colors.text,
      })}
    >
      <Stack.Screen
        name={name}
        options={{
          title,
          headerLargeTitleEnabled: deviceType !== DeviceType.TABLET,
        }}
      />
      {children}
    </Stack>
  );
}
