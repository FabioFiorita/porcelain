import { View } from 'react-native';
import { Text } from './text';
import { Button } from './button';
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: { label: string; onPress: () => void };
}) {
  return (
    <View className="gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
      <Text accessibilityRole="alert" variant="ui" tone="destructive">
        {message}
      </Text>
      {retry ? (
        <Button label={retry.label} variant="outline" onPress={retry.onPress} />
      ) : null}
    </View>
  );
}
