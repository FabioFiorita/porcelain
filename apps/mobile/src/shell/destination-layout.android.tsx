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
    <Stack>
      <Stack.Screen name={name} options={{ title }} />
      {children}
    </Stack>
  );
}
