import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AsyncResult } from 'effect/reactivity';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { HistoryList } from '../../../components/ui/history-list';
import { useSelectedWorktree } from '../../projects';
import { useHistory, type HistorySelection } from '../queries/history';
import { commitEntry, historyBoundary, historyHeading } from '../rules';

export function HistoryScreen() {
  const current = useSelectedWorktree();
  return current ? (
    <WorktreeHistory
      key={current.key}
      selection={current}
      workspace={current.key}
    />
  ) : (
    <Empty description="Select a worktree to continue." title="History" />
  );
}

function WorktreeHistory({
  selection,
  workspace,
}: {
  selection: HistorySelection;
  workspace: string;
}) {
  const history = useHistory(selection);
  const router = useRouter();
  const failed = AsyncResult.isFailure(history.result);
  if (!history.value)
    return failed ? (
      <ErrorState
        message="Couldn't load history"
        retry={{ label: 'Retry', onPress: history.retry }}
      />
    ) : (
      <Loading label="Loading commits…" />
    );
  const value = history.value;
  return (
    <View className="flex-1 bg-background">
      <View className="gap-2 border-b border-border px-4 py-2">
        <Text variant="caption" tone="muted">
          {historyHeading(value.snapshot)}
        </Text>
        {value.restarted ? (
          <Text variant="caption" tone="muted">
            History changed. Showing it from the top.
          </Text>
        ) : null}
      </View>
      {value.commits.length === 0 && !failed ? (
        <Empty
          title="No commits yet"
          description="Commits will appear here once this worktree has history."
        />
      ) : (
        <HistoryList
          entries={value.commits.map(commitEntry)}
          loading={history.result.waiting}
          hasMore={Boolean(value.nextAfter) && !failed}
          onLoadMore={history.readMore}
          onSelect={(oid) =>
            router.push({
              pathname: '/history/commit/[oid]',
              params: { oid, workspace },
            })
          }
          footer={
            failed ? (
              <ErrorState
                message="Couldn't load older commits"
                retry={{ label: 'Retry', onPress: history.readMore }}
              />
            ) : history.result.waiting ? (
              <Loading label="Loading older commits…" />
            ) : !value.nextAfter ? (
              <View className="py-4">
                <Text variant="caption" tone="muted" className="text-center">
                  {historyBoundary(value.boundary)}
                </Text>
              </View>
            ) : undefined
          }
        />
      )}
    </View>
  );
}
