import { FlatList, Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { Button } from '../../../shared/ui/button';
import { useHistory } from '../queries/history';
import { HistoryRow } from './history-row';

type HistoryWorkspace = Parameters<typeof useHistory>[0];

export function HistoryList({
  workspace,
  onOpen,
}: {
  workspace: HistoryWorkspace;
  onOpen: (oid: string) => void;
}) {
  const history = useHistory(workspace);
  const head = history.data?.snapshot?.head;
  const surface = useResolveClassNames('min-h-0 flex-1 bg-background');
  const toolbar = useResolveClassNames(
    'min-h-14 shrink-0 flex-row items-center gap-3 border-b border-border px-4 py-2',
  );
  const heading = useResolveClassNames('min-w-0 flex-1 gap-0.5');
  const title = useResolveClassNames('text-sm font-semibold text-foreground');
  const caption = useResolveClassNames('text-xs text-muted-foreground');
  const notice = useResolveClassNames(
    'border-b border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground',
  );
  const error = useResolveClassNames('px-4 py-3 text-sm text-destructive');
  const empty = useResolveClassNames('items-center gap-2 px-6 py-12');
  const footer = useResolveClassNames('gap-2 px-4 py-4');
  return (
    <View style={surface}>
      <View style={toolbar}>
        <View style={heading}>
          <Text accessibilityRole="header" style={title}>
            History
          </Text>
          {head ? (
            <Text numberOfLines={1} style={caption}>
              {head.kind === 'detached'
                ? 'Detached HEAD'
                : worktreeLabel(head.ref)}
            </Text>
          ) : null}
        </View>
        <Button
          label="Refresh history"
          variant="ghost"
          size="sm"
          onPress={history.read}
        />
      </View>
      {history.data?.restarted ? (
        <Text accessibilityLiveRegion="polite" style={notice}>
          History changed. Showing it from the top.
        </Text>
      ) : null}
      {history.error && !history.isFetchNextPageError ? (
        <Text accessibilityRole="alert" style={error}>
          Could not read history. {history.error.message}
        </Text>
      ) : null}
      <FlatList
        style={surface}
        contentInsetAdjustmentBehavior="automatic"
        data={history.data?.commits ?? []}
        keyExtractor={(commit) => commit.oid}
        renderItem={({ item }) => (
          <HistoryRow commit={item} onOpen={() => onOpen(item.oid)} />
        )}
        ListEmptyComponent={
          <View style={empty}>
            <Text accessibilityLiveRegion="polite" style={title}>
              {history.isPending
                ? 'Reading history…'
                : history.data
                  ? 'No commits yet'
                  : ''}
            </Text>
            {history.data ? (
              <Text style={caption}>
                Commits will appear here once this worktree has history.
              </Text>
            ) : null}
          </View>
        }
        ListFooterComponent={
          <View style={footer}>
            {history.isFetchNextPageError ? (
              <Text accessibilityRole="alert" style={caption}>
                Could not read older commits.
              </Text>
            ) : null}
            {history.hasNextPage ? (
              <Button
                label={
                  history.isFetchingNextPage
                    ? 'Reading older commits…'
                    : history.isFetchNextPageError
                      ? 'Read older commits again'
                      : 'Load older commits'
                }
                disabled={history.isFetchingNextPage}
                variant="outline"
                onPress={history.loadMore}
              />
            ) : history.data && history.data.commits.length > 0 ? (
              <Text style={caption}>
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
    </View>
  );
}
