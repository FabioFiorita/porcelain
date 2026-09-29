import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { HISTORY_ROW_HEIGHT } from '@/config/limits';
import { HistorySentinel } from '../adapters/history-sentinel';
import { historyGraphWidth, type GraphRow } from '../rules/graph';
import { CommitRow } from './commit-row';
import { HistoryGraph } from './history-graph';

export function HistoryRows({
  rows,
  selected,
  onSelect,
  loading,
  failed,
  nextAfter,
  boundary,
  onLoadMore,
  canLoadMore,
}: {
  rows: readonly GraphRow[];
  selected: string;
  onSelect: (oid: string) => void;
  loading: boolean;
  failed: boolean;
  nextAfter: readonly string[] | null;
  boundary: 'shallow' | 'wide' | null;
  onLoadMore: () => void;
  canLoadMore: boolean;
}) {
  return (
    <div className="flex px-1.5 py-2">
      <HistoryGraph rows={rows} width={historyGraphWidth(rows)} />
      <div className="min-w-0 flex-1">
        {rows.map(({ commit }) => (
          <CommitRow
            key={commit.oid}
            commit={commit}
            height={HISTORY_ROW_HEIGHT}
            selected={selected === commit.oid}
            onSelect={() => onSelect(commit.oid)}
          />
        ))}
        {loading ? (
          <p className="flex items-center gap-2 px-2 py-3 text-[11px] text-muted-foreground">
            <Spinner className="size-3.5" />
            Loading older commits…
          </p>
        ) : failed ? (
          <div className="flex items-center gap-2 px-2 py-2 text-[11px] text-muted-foreground">
            <span>Couldn&apos;t load older commits</span>
            <Button size="xs" variant="outline" onClick={onLoadMore}>
              Retry
            </Button>
          </div>
        ) : nextAfter == null ? (
          <p className="px-2 py-3 text-[11px] text-muted-foreground">
            {boundary === 'shallow'
              ? 'Shallow clone: older history is not available.'
              : boundary === 'wide'
                ? 'Too many branches meet here to continue past this point.'
                : 'Start of history.'}
          </p>
        ) : null}
        <HistorySentinel enabled={canLoadMore} onVisible={onLoadMore} />
      </div>
    </div>
  );
}
