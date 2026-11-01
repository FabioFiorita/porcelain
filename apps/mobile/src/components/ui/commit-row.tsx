import type { CommitRef } from '@porcelain/client/history/rules';
import { View } from 'react-native';
import { Item } from './item';
import { Badge } from './badge';
import { Text } from './text';
import { Icon } from './icon';
import { commitRefLabel } from '../../shared/rules/commit-ref';

export type HistoryEntry = {
  id: string;
  subject: string;
  author: string;
  time: string;
  shortHash: string;
  refs?: readonly CommitRef[];
  change?: string;
  graph?: { merge: boolean; continues: boolean };
};
export function CommitRow({
  entry,
  selected = false,
  connected = false,
  last = false,
  onPress,
}: {
  entry: HistoryEntry;
  selected?: boolean;
  connected?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <View className="flex-row items-stretch">
      <View
        className="w-6 items-center"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <View className={`h-4 w-px ${connected ? 'bg-graph-1' : ''}`} />
        <View
          className={`size-2.5 rounded-full border border-graph-1 ${entry.graph?.merge ? 'bg-background' : 'bg-graph-1'}`}
        />
        <View
          className={`w-px flex-1 ${!last && (entry.graph?.continues ?? true) ? 'bg-graph-1' : ''}`}
        />
      </View>
      <View className="min-w-0 flex-1 border-b border-border">
        <Item
          title={entry.subject}
          titleNumberOfLines={2}
          selected={selected}
          onPress={onPress}
          size="sm"
          accessibilityLabel={`${entry.graph?.merge ? 'Merge commit · ' : ''}${entry.subject} · ${entry.shortHash} · ${entry.author} · ${entry.time}${entry.change ? ` · ${entry.change}` : ''}${entry.refs?.length ? ` · ${entry.refs.map(commitRefLabel).join(', ')}` : ''}`}
          trailing={<Icon name="chevron" size="small" tone="muted" />}
        >
          <Text variant="caption" tone="muted" numberOfLines={1}>
            <Text variant="code" tone="muted">
              {entry.shortHash}
            </Text>{' '}
            · {entry.author} · {entry.time}
          </Text>
          {entry.refs?.length ? (
            <View className="flex-row flex-wrap gap-1">
              {entry.refs.map((ref) => (
                <Badge
                  key={`${ref.kind}:${ref.name}`}
                  label={commitRefLabel(ref)}
                  labelNumberOfLines={1}
                  className="max-w-full"
                  variant="secondary"
                />
              ))}
            </View>
          ) : null}
          {entry.change ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {entry.change}
            </Text>
          ) : null}
        </Item>
      </View>
    </View>
  );
}
