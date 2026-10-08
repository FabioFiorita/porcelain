import { View } from 'react-native';
import { Text } from './text';
import { Badge } from './badge';
import { Button } from './button';

export type ReviewRange = { side: 'old' | 'new'; start: number; end: number };
export function ReviewAnnotation({
  author,
  body,
  range,
  status = 'pending',
  onResolve,
}: {
  author: string;
  body: string;
  range?: ReviewRange;
  status?: 'pending' | 'resolved';
  onResolve?: () => void;
}) {
  return (
    <View className="gap-3 rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="ui" weight="medium">
          {author}
        </Text>
        <Badge
          label={status === 'resolved' ? 'Resolved' : 'Pending'}
          variant="secondary"
        />
      </View>
      {range ? (
        <Text variant="caption" tone="muted">
          {range.side} lines {range.start}–{range.end}
        </Text>
      ) : null}
      <Text variant="ui" selectable>
        {body}
      </Text>
      {onResolve && status === 'pending' ? (
        <Button
          label="Resolve"
          size="sm"
          variant="outline"
          onPress={onResolve}
        />
      ) : null}
    </View>
  );
}
