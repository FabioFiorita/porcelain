import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { HISTORY_GRAPH_ROW_HEIGHT, RECENT_COMMIT_ROWS } from '@/config/limits';
import { useReviewOverview } from '@/features/changes/index';
import {
  branchTracking,
  type HistoryScope,
} from '@porcelain/client/history/rules';
import { type Connection } from '@/shared/workspace/connection';
import { useHistory } from '../queries/history';
import { BranchTracking } from './branch-tracking';
import { CommitRow } from './commit-row';

export function RecentHistory({
  scope,
  connection,
  sideLabel,
  status,
  onOpenCommit,
  onOpenGraph,
}: {
  scope: HistoryScope;
  connection: Connection;
  sideLabel: string;
  status: ReactNode;
  onOpenCommit: (oid: string, toSide?: boolean) => void;
  onOpenGraph: () => void;
}) {
  const history = useHistory(connection, scope);
  const overview = Option.getOrUndefined(
    AsyncResult.value(useReviewOverview(scope, connection)),
  );
  const tracking = branchTracking(overview?.branch, history.snapshot);
  const headRef =
    history.snapshot?.head.kind === 'attached'
      ? history.snapshot.head.ref
      : undefined;
  const commits = history.commits.slice(0, RECENT_COMMIT_ROWS);
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Branch" className="flex flex-col gap-2 px-2">
        <BranchTracking tracking={tracking} />
        {status}
      </section>
      {commits.length > 0 && (
        <section
          aria-labelledby="recent-commits"
          className="@container/graph flex flex-col"
        >
          <div className="flex h-8 items-center gap-2 border-b px-2">
            <h2
              id="recent-commits"
              className="min-w-0 flex-1 text-caption font-medium text-muted-foreground"
            >
              Recent commits
            </h2>
            <Button variant="ghost" size="xs" onClick={onOpenGraph}>
              Open graph
              <ChevronRightIcon className="text-muted-foreground" />
            </Button>
          </div>
          <ol aria-label="Recent commits" className="flex flex-col pt-1">
            {commits.map((commit) => (
              <li key={commit.oid}>
                <CommitRow
                  commit={commit}
                  selected={false}
                  height={HISTORY_GRAPH_ROW_HEIGHT}
                  inset={8}
                  layout="columns"
                  headRef={headRef}
                  onSelect={(toSide) => onOpenCommit(commit.oid, toSide)}
                  openToSide={{
                    label: sideLabel,
                    open: () => onOpenCommit(commit.oid, true),
                  }}
                />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
