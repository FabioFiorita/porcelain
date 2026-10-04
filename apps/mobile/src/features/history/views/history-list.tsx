import { Button, Host } from '@expo/ui';
import { FlatList, Text, View } from 'react-native';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { useHistory, type HistoryWorkspace } from '../queries/history';

export function HistoryList({
  workspace,
  onOpen,
}: {
  workspace: HistoryWorkspace;
  onOpen: (oid: string) => void;
}) {
  const history = useHistory(workspace);
  const head = history.data?.snapshot?.head;
  return (
    <FlatList
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      data={history.data?.commits ?? []}
      keyExtractor={(commit) => commit.oid}
      ListHeaderComponent={
        <View className="gap-2 px-6 pt-6 pb-3">
          <Text
            accessibilityRole="header"
            className="text-xl font-semibold text-foreground"
          >
            History
          </Text>
          {head ? (
            <Text className="text-sm text-muted-foreground">
              {head.kind === 'detached'
                ? 'Detached HEAD'
                : worktreeLabel(head.ref)}
            </Text>
          ) : null}
          <Host matchContents={{ vertical: true }}>
            <Button
              label="Refresh history"
              variant="text"
              onPress={history.read}
            />
          </Host>
          {history.data?.restarted ? (
            <Text className="text-sm text-muted-foreground">
              History changed. Showing it from the top.
            </Text>
          ) : null}
          {history.error && !history.isFetchNextPageError ? (
            <Text className="text-sm text-destructive">
              Could not read history. {history.error.message}
            </Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <View className="gap-1 border-b border-border px-6 py-3">
          <Host matchContents={{ vertical: true }}>
            <Button
              testID={`history-commit-${item.oid}`}
              label={item.subject}
              variant="text"
              onPress={() => onOpen(item.oid)}
            />
          </Host>
          <Text className="text-xs text-muted-foreground">
            {item.author.name} · {item.author.timestamp}
          </Text>
          <Text className="font-mono text-xs text-muted-foreground">
            {item.oid.slice(0, 7)}
            {item.parentOids.length > 1 ? ' · Merge commit' : ''}
          </Text>
          {item.refs.length > 0 ? (
            <Text className="text-xs text-muted-foreground">
              {item.refs.map((ref) => worktreeLabel(ref)).join(' · ')}
            </Text>
          ) : null}
        </View>
      )}
      ListEmptyComponent={
        <Text className="px-6 py-4 text-sm text-muted-foreground">
          {history.isPending
            ? 'Reading history…'
            : history.data
              ? 'No commits yet'
              : ''}
        </Text>
      }
      ListFooterComponent={
        <View className="gap-2 px-6 py-4">
          {history.isFetchNextPageError ? (
            <Text className="text-sm text-destructive">
              Could not read older commits.
            </Text>
          ) : null}
          {history.hasNextPage ? (
            <Host matchContents={{ vertical: true }}>
              <Button
                label={
                  history.isFetchingNextPage
                    ? 'Reading older commits…'
                    : history.isFetchNextPageError
                      ? 'Read older commits again'
                      : 'Load older commits'
                }
                disabled={history.isFetchingNextPage}
                variant="text"
                onPress={history.loadMore}
              />
            </Host>
          ) : history.data && history.data.commits.length > 0 ? (
            <Text className="text-sm text-muted-foreground">
              {history.data.boundary === 'shallow'
                ? 'History stops at the shallow clone boundary.'
                : history.data.boundary === 'wide'
                  ? 'History is too wide to continue.'
                  : 'Start of history.'}
            </Text>
          ) : null}
        </View>
      }
    />
  );
}
