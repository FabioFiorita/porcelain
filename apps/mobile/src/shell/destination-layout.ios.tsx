import { Slot, Stack } from 'expo-router';
import { DeviceType, deviceType } from 'expo-device';

export function DestinationLayout({
  name,
  title,
}: {
  name: string;
  title: string;
}) {
  if (deviceType === DeviceType.TABLET) return <Slot />;
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name={name} options={{ title }} />
    </Stack>
  );
}
