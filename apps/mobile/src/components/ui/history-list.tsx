import { FlatList, View } from 'react-native';
import { CommitRow, type HistoryEntry } from './commit-row';
import { Empty } from './empty';
import { Loading } from './loading';
import { Text } from './text';
import { Separator } from './separator';

export function HistoryList({
  entries,
  selected,
  loading = false,
  hasMore = false,
  onSelect,
  onLoadMore,
}: {
  entries: readonly HistoryEntry[];
  selected?: string;
  loading?: boolean;
  hasMore?: boolean;
  onSelect: (id: string) => void;
  onLoadMore?: () => void;
}) {
  return (
    <FlatList
      contentContainerStyle={{ paddingHorizontal: 8 }}
      data={entries}
      keyExtractor={(entry) => entry.id}
      renderItem={({ item }) => (
        <CommitRow
          entry={item}
          selected={selected === item.id}
          onPress={() => onSelect(item.id)}
        />
      )}
      ItemSeparatorComponent={() => (
        <View className="py-1">
          <Separator />
        </View>
      )}
      ListEmptyComponent={
        loading ? (
          <></>
        ) : (
          <Empty
            title="No commits"
            description="This history has no commits to display."
            icon="history"
          />
        )
      }
      ListFooterComponent={
        loading ? (
          <Loading label="Loading commits…" />
        ) : entries.length && !hasMore ? (
          <View className="py-4">
            <Text variant="caption" tone="muted" className="text-center">
              End of history
            </Text>
          </View>
        ) : (
          <></>
        )
      }
      onEndReached={() => {
        if (hasMore && !loading) onLoadMore?.();
      }}
      onEndReachedThreshold={0.3}
    />
  );
}
