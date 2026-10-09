import { ActivityIndicator, View } from 'react-native';
import { Text } from './text';
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View
      accessibilityState={{ busy: true }}
      className="flex-row items-center justify-center gap-3 py-4"
    >
      <ActivityIndicator
        size="small"
        colorClassName="accent-muted-foreground"
      />
      <Text variant="ui" tone="muted">
        {label}
      </Text>
    </View>
  );
}
