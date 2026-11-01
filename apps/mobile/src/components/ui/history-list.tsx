import { useResolveClassNames } from 'uniwind';
import type { ReactNode } from 'react';
import { FlatList, View } from 'react-native';
import { CommitRow, type HistoryEntry } from './commit-row';
import { Empty } from './empty';
import { Loading } from './loading';
import { Text } from './text';
import { Item } from './item';
import { useListReadingOffset } from './list-reading-offset';

export function HistoryList({
  entries,
  selected,
  loading = false,
  hasMore = false,
  onSelect,
  onLoadMore,
  footer,
  header,
  uncommitted,
  unavailable = false,
  empty,
  scrollOffset = 0,
  onScrollOffset,
}: {
  entries: readonly HistoryEntry[];
  selected?: string;
  loading?: boolean;
  hasMore?: boolean;
  onSelect: (id: string) => void;
  onLoadMore?: () => void;
  footer?: ReactNode;
  header?: ReactNode;
  uncommitted?: string;
  unavailable?: boolean;
  empty?: ReactNode;
  scrollOffset?: number;
  onScrollOffset?: ((offset: number) => void) | undefined;
}) {
  const padding = useResolveClassNames('px-2');
  const reading = useListReadingOffset(
    scrollOffset,
    !loading && entries.length > 0,
    onScrollOffset,
  );
  return (
    <FlatList
      {...reading}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={padding}
      ListHeaderComponent={
        <>
          {header}
          {uncommitted ? (
            <View className="flex-row items-stretch">
              <View
                className="w-6 items-center"
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              >
                <View className="h-4" />
                <View className="size-2.5 rounded-full border border-dashed border-muted-foreground bg-background" />
                <View
                  className={`w-px flex-1 ${entries.length ? 'bg-graph-1' : ''}`}
                />
              </View>
              <View className="min-w-0 flex-1 border-b border-border">
                <Item
                  title="Uncommitted changes"
                  size="sm"
                  trailing={
                    <Text variant="caption" tone="muted">
                      {uncommitted}
                    </Text>
                  }
                />
              </View>
            </View>
          ) : null}
        </>
      }
      data={entries}
      keyExtractor={(entry) => entry.id}
      renderItem={({ item, index }) => (
        <CommitRow
          entry={item}
          selected={selected === item.id}
          connected={index > 0 || Boolean(uncommitted)}
          last={index === entries.length - 1 && !hasMore}
          onPress={() => onSelect(item.id)}
        />
      )}
      ListEmptyComponent={
        loading || unavailable || hasMore ? (
          <></>
        ) : (
          <>
            {empty ?? (
              <Empty
                title="No commits yet"
                description="Commits will appear here once this worktree has history."
                icon="history"
              />
            )}
          </>
        )
      }
      ListFooterComponent={
        footer !== undefined ? (
          <>{footer}</>
        ) : loading ? (
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
