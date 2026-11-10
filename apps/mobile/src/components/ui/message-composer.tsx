import { TextInput, View } from 'react-native';
import { IconButton } from './icon-button';
import { Text } from './text';

export function MessageComposer({
  value,
  placeholder,
  sending = false,
  error,
  onChangeText,
  onSend,
}: {
  value: string;
  placeholder: string;
  sending?: boolean;
  error?: string | undefined;
  onChangeText: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-end gap-2 rounded-xl border border-input bg-input/20 py-1 pr-1 pl-3 dark:bg-input/30">
        <TextInput
          value={value}
          multiline
          maxLength={8000}
          accessibilityLabel={placeholder}
          placeholder={placeholder}
          placeholderTextColorClassName="accent-muted-foreground"
          selectionColorClassName="accent-primary"
          textAlignVertical="center"
          className="max-h-40 min-h-8 flex-1 py-1.5 text-base leading-5.5 text-foreground"
          onChangeText={onChangeText}
        />
        <IconButton
          icon="send"
          variant="filled"
          size="sm"
          accessibilityLabel="Send"
          disabled={!value.trim() || sending}
          pending={sending}
          onPress={onSend}
        />
      </View>
      {error ? (
        <Text variant="caption" tone="destructive" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
