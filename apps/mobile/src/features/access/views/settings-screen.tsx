import { Column, Host, Text } from '@expo/ui';

export function SettingsScreen() {
  return (
    <Host style={{ flex: 1 }}>
      <Column>
        <Text>Environments</Text>
        <Text>No environments paired.</Text>
      </Column>
    </Host>
  );
}
