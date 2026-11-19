import { View } from 'react-native';
import { Text } from './text';
import { Button } from './button';
export function Empty({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void } | undefined;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background px-6 py-8">
      <Text variant="secondary" tone="muted" className="text-center">
        {title}
      </Text>
      {action ? (
        <Button label={action.label} onPress={action.onPress} variant="tonal" />
      ) : null}
    </View>
  );
}
