import { GitBranchIcon, GitGraphIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { worktreeLabel } from '@/features/projects/index';
import { useHistory } from '../queries/history';
import type { HistoryScope } from '../rules/connection';
import { historyFollows } from '../rules/graph';
import { HistoryRows } from './history-rows';
import { type Connection } from '@/shared/workspace/connection';

export function HistoryNavigation({
  scope,
  connection,
  selected,
  onSelect,
  onOpenGraph,
}: {
  scope: HistoryScope;
  connection: Connection;
  selected: string;
  onSelect: (oid: string) => void;
  onOpenGraph: () => void;
}) {
  const history = useHistory(connection, scope);

  return (
    <div className="flex flex-col">
      <HistoryHeading
        history={history}
        action={
          history.commits.length > 0 ? (
            <Button size="xs" variant="ghost" onClick={onOpenGraph}>
              <GitGraphIcon />
              Open graph
            </Button>
          ) : undefined
        }
      />
      {history.commits.length === 0 ? (
        <NoCommits />
      ) : (
        <HistoryRows
          commits={history.commits}
          history={history}
          selected={selected}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

export function HistoryHeading({
  history,
  action,
}: {
  history: ReturnType<typeof useHistory>;
  action?: ReactNode;
}) {
  return (
    <>
      {(history.snapshot != null || action !== undefined) && (
        <div className="flex shrink-0 items-center gap-1.5 border-b py-1.5 pr-1.5 pl-3.5 text-[11.5px] text-muted-foreground">
          <GitBranchIcon className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {historyFollows(history.snapshot ?? undefined, worktreeLabel)}
          </span>
          {action}
        </div>
      )}
      {history.restarted && (
        <p
          role="status"
          className="shrink-0 border-b bg-muted/40 px-3.5 py-2 text-[11.5px] text-muted-foreground"
        >
          History changed. Showing it from the top.
        </p>
      )}
    </>
  );
}

export function NoCommits() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>No commits yet</EmptyTitle>
        <EmptyDescription>
          Commits will appear here once this worktree has history.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
