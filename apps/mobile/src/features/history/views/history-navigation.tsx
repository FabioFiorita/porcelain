import { Box } from '../../../components/ui/box';
import { AsyncResult } from 'effect/reactivity';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { HistoryList } from '../../../components/ui/history-list';
import {
  useHistory,
  useHistoryStatus,
  type HistorySelection,
} from '../queries/history';
import { commitEntry, historyBoundary } from '@porcelain/client/history/rules';
import { historyStatus } from '../rules/status';

export function HistoryNavigation({
  selection,
  workspace,
  selected,
  onOpen,
}: {
  selection: HistorySelection;
  workspace: string;
  selected?: string | undefined;
  onOpen: (oid: string, workspace: string) => void;
}) {
  const history = useHistory(selection);
  const status = useHistoryStatus(selection);
  const failed = AsyncResult.isFailure(history.result);
  const value = history.value;
  const branch = AsyncResult.isSuccess(status.result)
    ? historyStatus(status.result.value, value?.snapshot ?? null)
    : undefined;
  return (
    <Box collapsable={false} className="flex-1" surface="background">
      <HistoryList
        header={
          <Box gap={2} divider="bottom" paddingX={4} paddingY={3}>
            <BranchStatus status={status} branch={branch} />
            {value?.restarted ? (
              <Text variant="caption" tone="muted">
                History changed. Showing it from the top.
              </Text>
            ) : null}
          </Box>
        }
        {...(branch?.uncommitted === undefined
          ? {}
          : { uncommitted: branch.uncommitted })}
        {...(selected === undefined ? {} : { selected })}
        entries={
          value?.commits.map((commit) => ({
            ...commitEntry(commit),
            graph: {
              merge: commit.parentOids.length > 1,
              continues: commit.parentOids.length > 0,
            },
          })) ?? []
        }
        loading={history.result.waiting || (!value && !failed)}
        hasMore={Boolean(value?.nextAfter) && !failed}
        onLoadMore={history.readMore}
        onSelect={(oid) => onOpen(oid, workspace)}
        footer={<HistoryFooter history={history} />}
        unavailable={failed}
      />
    </Box>
  );
}

function BranchStatus({
  status,
  branch,
}: {
  status: ReturnType<typeof useHistoryStatus>;
  branch: ReturnType<typeof historyStatus> | undefined;
}) {
  if (branch)
    return (
      <>
        <Text
          variant="code"
          weight="medium"
          numberOfLines={1}
          accessibilityLabel={branch.name}
        >
          {branch.name}
        </Text>
        {branch.counts !== null ? (
          <Text variant="caption" tone="muted">
            {branch.counts}
          </Text>
        ) : null}
        <Text
          variant="caption"
          tone="muted"
          numberOfLines={1}
          accessibilityLabel={branch.upstream}
        >
          {branch.upstream}
        </Text>
      </>
    );
  if (AsyncResult.isFailure(status.result))
    return (
      <ErrorState
        message="Couldn't load branch status. The computer may be unreachable."
        retry={{
          label: 'Retry branch status',
          onPress: status.retry,
          pending: status.result.waiting,
        }}
      />
    );
  return <Loading label="Loading branch status…" />;
}

function HistoryFooter({
  history,
}: {
  history: ReturnType<typeof useHistory>;
}) {
  const value = history.value;
  const failed = AsyncResult.isFailure(history.result);
  if (!value) {
    if (failed)
      return (
        <ErrorState
          message="Couldn't load history"
          retry={{ label: 'Retry', onPress: history.retry }}
        />
      );
    return <Loading label="Loading commits…" />;
  }
  if (failed)
    return (
      <ErrorState
        message="Couldn't load older commits"
        retry={{ label: 'Retry', onPress: history.readMore }}
      />
    );
  if (history.result.waiting) return <Loading label="Loading older commits…" />;
  if (value.nextAfter || value.commits.length === 0) return null;
  return (
    <Box paddingY={4}>
      <Text variant="caption" tone="muted" className="text-center">
        {historyBoundary(value.boundary)}
      </Text>
    </Box>
  );
}
