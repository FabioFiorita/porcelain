import { Stack } from 'expo-router';

export function DestinationLayout({
  name,
  title,
}: {
  name: string;
  title: string;
}) {
  return (
    <Stack>
      <Stack.Screen name={name} options={{ title }} />
    </Stack>
  );
}
