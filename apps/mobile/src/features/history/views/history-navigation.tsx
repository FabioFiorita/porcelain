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
import { commitAge } from '../rules/commit-age';
import { Icon } from '../../../components/ui/icon';

export function HistoryNavigation({
  selection,
  workspace,
  project,
  selected,
  onOpen,
}: {
  selection: HistorySelection;
  workspace: string;
  project: string;
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
            <BranchStatus status={status} branch={branch} project={project} />
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
            time: commitAge(commit.author.timestamp),
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
  project,
}: {
  status: ReturnType<typeof useHistoryStatus>;
  branch: ReturnType<typeof historyStatus> | undefined;
  project: string;
}) {
  if (branch)
    return (
      <Box className="flex-row items-center" gap={3}>
        <Box
          className="size-8 items-center justify-center rounded-lg border border-border bg-muted"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon name="branch" size="small" />
        </Box>
        <Box className="min-w-0 flex-1" gap={0.5}>
          <Text
            variant="code"
            weight="medium"
            numberOfLines={1}
            accessibilityLabel={branch.name}
          >
            {branch.name}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            numberOfLines={2}
            accessibilityLabel={[project, branch.counts, branch.upstream]
              .filter(Boolean)
              .join(' · ')}
          >
            {[project, branch.counts, branch.upstream]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </Box>
      </Box>
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
