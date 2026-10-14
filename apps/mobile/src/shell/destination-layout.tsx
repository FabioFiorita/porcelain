import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { DestinationHeader } from './destination-header';

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
        headerBackVisible: true,
        headerLargeTitleEnabled: false,
        headerTintColor: theme.colors.text,
      })}
      screenLayout={({ children, route }) => (
        <DestinationHeader
          leading={route.name !== 'files' && name !== 'settings'}
        >
          {children}
        </DestinationHeader>
      )}
    >
      <Stack.Screen name={name} options={{ title }} />
      {children}
    </Stack>
  );
}
