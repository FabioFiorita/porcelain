import { Button, Host } from '@expo/ui';
import { Text, View } from 'react-native';
import { fileReadError } from '@porcelain/client/files/rules';

export function ReadState({
  pending,
  error,
  onRead,
}: {
  pending: boolean;
  error: unknown;
  onRead: () => void;
}) {
  return (
    <View className="gap-3 px-4 py-3">
      <Text className="text-sm text-muted-foreground">
        {pending ? 'Reading files…' : fileReadError(error)}
      </Text>
      {pending ? null : (
        <Host matchContents={{ vertical: true }}>
          <Button label="Read again" variant="outlined" onPress={onRead} />
        </Host>
      )}
    </View>
  );
}
