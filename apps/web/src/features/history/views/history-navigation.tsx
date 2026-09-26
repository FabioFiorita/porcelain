import { GitBranchIcon } from 'lucide-react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { useAccessStore } from '@/features/access/index';
import { worktreeLabel } from '@/features/projects/index';
import { useHistory } from '../queries/history';
import type { HistoryScope } from '../rules/connection';
import { historyFollows, layoutGraph } from '../rules/graph';
import { HistoryRows } from './history-rows';

export function HistoryNavigation({
  scope,
  selected,
  onSelect,
}: {
  scope: HistoryScope;
  selected: string;
  onSelect: (oid: string) => void;
}) {
  const connection = useAccessStore((state) => state.connection);
  const history = useHistory(connection, scope);
  const rows = layoutGraph(history.commits);
  const observe =
    history.hasNextPage &&
    !history.isFetchingNextPage &&
    !history.isFetchNextPageError;

  return (
    <div className="flex flex-col">
      {history.snapshot != null && (
        <p className="flex shrink-0 items-center gap-1.5 border-b px-3.5 py-2 text-[11.5px] text-muted-foreground">
          <GitBranchIcon className="size-3.5 shrink-0" />
          <span className="truncate">
            {historyFollows(history.snapshot, worktreeLabel)}
          </span>
        </p>
      )}
      {history.restarted && (
        <p
          role="status"
          className="shrink-0 border-b bg-muted/40 px-3.5 py-2 text-[11.5px] text-muted-foreground"
        >
          History changed. Showing it from the top.
        </p>
      )}
      {rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No commits yet</EmptyTitle>
            <EmptyDescription>
              Commits will appear here once this worktree has history.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <HistoryRows
          rows={rows}
          selected={selected}
          onSelect={onSelect}
          loading={history.isFetchingNextPage}
          failed={history.isFetchNextPageError}
          nextAfter={history.nextAfter}
          boundary={history.boundary}
          onLoadMore={history.loadNextPage}
          canLoadMore={observe}
        />
      )}
    </div>
  );
}
