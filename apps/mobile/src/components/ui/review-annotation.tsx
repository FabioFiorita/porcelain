import { View } from 'react-native';
import { Text } from './text';
import { Badge } from './badge';
import { Button } from './button';
import type { CreateCommentThreadResponse } from '@porcelain/contracts/reviews';

type CodeRangeAnchor = Extract<
  CreateCommentThreadResponse['anchor'],
  { kind: 'codeRange' }
>;
export type ReviewRange = Pick<
  CodeRangeAnchor,
  'startLine' | 'endLine' | 'side'
>;
export function ReviewAnnotation({
  author,
  body,
  label,
  resolved = false,
  onResolve,
}: {
  author: CreateCommentThreadResponse['messages'][number]['author'];
  body: string;
  label?: string;
  resolved?: boolean;
  onResolve?: () => void;
}) {
  return (
    <View className="gap-3 rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="ui" weight="medium">
          {author === 'agent' ? 'Agent' : 'You'}
        </Text>
        <Badge label={resolved ? 'Resolved' : 'Pending'} variant="secondary" />
      </View>
      {label ? (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      ) : null}
      <Text variant="ui" selectable>
        {body}
      </Text>
      {onResolve && !resolved ? (
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
