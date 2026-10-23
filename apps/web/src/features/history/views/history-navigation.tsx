import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  ChevronRightIcon,
  CircleDashedIcon,
  GitBranchIcon,
  GitGraphIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { useHistory } from '../queries/history';
import type { HistoryScope } from '@porcelain/client/history/rules';
import {
  branchTracking,
  historyHeading,
} from '@porcelain/client/history/rules';
import { useReviewOverview } from '@/features/changes/index';
import { GraphRows } from './history-rows';
import { type Connection } from '@/shared/workspace/connection';

export function HistoryNavigation({
  scope,
  connection,
  selected,
  onSelect,
  sideLabel,
  onOpenGraph,
  onOpenChanges,
}: {
  scope: HistoryScope;
  connection: Connection;
  selected: string;
  onSelect: (oid: string, toSide?: boolean) => void;
  sideLabel: string;
  onOpenGraph: () => void;
  onOpenChanges: () => void;
}) {
  const history = useHistory(connection, scope);
  const overview = Option.getOrUndefined(
    AsyncResult.value(useReviewOverview(scope, connection)),
  );
  const tracking = branchTracking(overview?.branch, history.snapshot);
  const uncommitted = overview?.changes.length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <section
        aria-label="Branch"
        className="flex shrink-0 items-start gap-2 border-b px-3.5 py-2.5"
      >
        <GitBranchIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 flex-1 font-mono text-caption font-medium wrap-anywhere">
              {tracking.name}
            </span>
            {tracking.counts !== null && (
              <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
                {tracking.counts}
              </span>
            )}
          </div>
          <span className="text-2xs text-muted-foreground wrap-anywhere">
            {tracking.upstream}
          </span>
        </div>
      </section>
      <HistoryRestarted history={history} />
      <ScrollArea className="h-0 min-h-0 flex-1">
        {uncommitted > 0 && (
          <div className="px-1.5 pt-2">
            <button
              type="button"
              onClick={onOpenChanges}
              className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-caption transition-colors hover:bg-accent"
            >
              <CircleDashedIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">Uncommitted changes</span>
              <span className="text-2xs text-muted-foreground tabular-nums">
                {uncommitted} {uncommitted === 1 ? 'file' : 'files'}
              </span>
            </button>
          </div>
        )}
        {history.commits.length === 0 ? (
          <NoCommits />
        ) : (
          <GraphRows
            label="Commits"
            history={history}
            selected={selected}
            onSelect={onSelect}
            sideLabel={sideLabel}
          />
        )}
      </ScrollArea>
      {history.commits.length > 0 && (
        <div className="shrink-0 border-t p-1.5">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={onOpenGraph}
          >
            <GitGraphIcon />
            Open graph
            <ChevronRightIcon className="ml-auto text-muted-foreground" />
          </Button>
        </div>
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
      {((history.snapshot !== null && history.snapshot !== undefined) ||
        action !== undefined) && (
        <div className="flex shrink-0 items-center gap-1.5 border-b py-1.5 pr-1.5 pl-3.5 text-2xs text-muted-foreground">
          <GitBranchIcon className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {historyHeading(history.snapshot)}
          </span>
          {action}
        </div>
      )}
      <HistoryRestarted history={history} />
    </>
  );
}

function HistoryRestarted({
  history,
}: {
  history: ReturnType<typeof useHistory>;
}) {
  if (!history.restarted) return null;
  return (
    <p
      role="status"
      className="shrink-0 border-b bg-muted/40 px-3.5 py-2 text-2xs text-muted-foreground"
    >
      History changed. Showing it from the top.
    </p>
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
