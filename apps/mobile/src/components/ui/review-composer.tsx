import { View } from 'react-native';
import { Input } from './input';
import { Field } from './field';
import { Button } from './button';
import { Text } from './text';
import { Card } from './card';

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
    <Card gap={3} padding={4}>
      {label ? (
        <Text variant="caption" tone="muted">
          Comment on {label}
        </Text>
      ) : null}
      <Field label="Review comment" error={error}>
        <Input
          testID="review-comment-input"
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
    </Card>
  );
}
