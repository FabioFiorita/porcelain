import { View } from 'react-native';
import { Input } from './input';
import { Field } from './field';
import { Button } from './button';
import { Text } from './text';

export function ReviewComposer({
  value,
  onChangeText,
  onSubmit,
  onCancel,
  label,
  pending = false,
  error,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  label?: string;
  pending?: boolean;
  error?: string;
}) {
  return (
    <View className="gap-3 rounded-2xl border border-border bg-card p-4">
      {label ? (
        <Text variant="caption" tone="muted">
          Comment on {label}
        </Text>
      ) : null}
      <Field label="Review comment" error={error}>
        <Input
          accessibilityLabel="Review comment"
          placeholder="Share feedback…"
          multiline
          value={value}
          onChangeText={onChangeText}
          disabled={pending}
          invalid={!!error}
        />
      </Field>
      <View className="flex-row justify-end gap-2">
        <Button
          label="Cancel"
          variant="ghost"
          onPress={onCancel}
          disabled={pending}
        />
        <Button
          label="Add comment"
          onPress={onSubmit}
          disabled={!value.trim()}
          pending={pending}
        />
      </View>
    </View>
  );
}
