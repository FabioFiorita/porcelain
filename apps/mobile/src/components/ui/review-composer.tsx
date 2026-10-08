import { View } from 'react-native';
import { Input } from './input';
import { Field } from './field';
import { Button } from './button';
import { Text } from './text';
import type { ReviewRange } from './review-annotation';

export function ReviewComposer({
  value,
  onChangeText,
  onSubmit,
  onCancel,
  range,
  pending = false,
  error,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  range?: ReviewRange;
  pending?: boolean;
  error?: string;
}) {
  return (
    <View className="gap-3 rounded-2xl border border-border bg-card p-4">
      {range ? (
        <Text variant="caption" tone="muted">
          Comment on {range.side} lines {range.start}–{range.end}
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
