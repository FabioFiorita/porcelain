import { Box } from '../../../components/ui/box';
import { AsyncResult } from 'effect/reactivity';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { HistoryList } from '../../../components/ui/history-list';
import { useHistory, type HistorySelection } from '../queries/history';
import {
  commitEntry,
  historyBoundary,
  historyHeading,
} from '@porcelain/client/history/rules';

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
    <Box collapsable={false} className="flex-1" surface="background">
      {value.commits.length === 0 && !failed ? (
        <Empty
          title="No commits yet"
          description="Commits will appear here once this worktree has history."
        />
      ) : (
        <HistoryList
          header={
            <Box gap={2} divider="bottom" paddingX={4} paddingY={2}>
              <Text variant="caption" tone="muted">
                {historyHeading(value.snapshot)}
              </Text>
              {value.restarted ? (
                <Text variant="caption" tone="muted">
                  History changed. Showing it from the top.
                </Text>
              ) : null}
            </Box>
          }
          {...(selected === undefined ? {} : { selected })}
          entries={value.commits.map(commitEntry)}
          loading={history.result.waiting}
          hasMore={Boolean(value.nextAfter) && !failed}
          onLoadMore={history.readMore}
          onSelect={(oid) => onOpen(oid, workspace)}
          footer={
            <OlderCommitsFooter
              failed={failed}
              waiting={history.result.waiting}
              end={!value.nextAfter}
              endLabel={historyBoundary(value.boundary)}
              onRetry={history.readMore}
            />
          }
        />
      )}
    </Box>
  );
}

function OlderCommitsFooter({
  failed,
  waiting,
  end,
  endLabel,
  onRetry,
}: {
  failed: boolean;
  waiting: boolean;
  end: boolean;
  endLabel: string;
  onRetry: () => void;
}) {
  if (failed)
    return (
      <ErrorState
        message="Couldn't load older commits"
        retry={{ label: 'Retry', onPress: onRetry }}
      />
    );
  if (waiting) return <Loading label="Loading older commits…" />;
  if (!end) return null;
  return (
    <Box paddingY={4}>
      <Text variant="caption" tone="muted" className="text-center">
        {endLabel}
      </Text>
    </Box>
  );
}
