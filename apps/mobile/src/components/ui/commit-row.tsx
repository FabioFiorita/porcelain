import { View } from 'react-native';
import { Item } from './item';
import { Badge } from './badge';
import { Text } from './text';

export type HistoryEntry = {
  id: string;
  subject: string;
  author: string;
  time: string;
  shortHash: string;
  refs?: readonly string[];
};
export function CommitRow({
  entry,
  selected = false,
  onPress,
}: {
  entry: HistoryEntry;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Item
      title={entry.subject}
      description={`${entry.author} · ${entry.time}`}
      selected={selected}
      onPress={onPress}
    >
      <Text variant="code" tone="muted">
        {entry.shortHash}
      </Text>
      {entry.refs?.length ? (
        <View className="flex-row flex-wrap gap-1">
          {entry.refs.map((ref) => (
            <Badge key={ref} label={ref} variant="secondary" />
          ))}
        </View>
      ) : null}
    </Item>
  );
}
