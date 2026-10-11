import { Stack } from 'expo-router';
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
      <Stack.Screen name={name} options={{ title }} />
      {children}
    </Stack>
  );
}
