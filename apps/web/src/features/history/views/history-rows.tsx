import { formatDistanceToNowStrict } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { HISTORY_ROW_HEIGHT } from '@/config/limits';
import { cn } from '@/shared/lib/utils';
import { HistorySentinel } from '../adapters/history-sentinel';
import {
  historyGraphWidth,
  historyRefLabel,
  shortOid,
  type GraphRow,
} from '../rules/graph';
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
          <button
            type="button"
            key={commit.oid}
            style={{ height: HISTORY_ROW_HEIGHT }}
            aria-pressed={selected === commit.oid}
            title={commit.subject}
            onClick={() => onSelect(commit.oid)}
            className={cn(
              'flex w-full flex-col justify-center gap-0.5 rounded-lg px-2 text-left transition-colors hover:bg-accent',
              selected === commit.oid && 'bg-accent',
            )}
          >
            <span className="truncate text-[12.5px] leading-tight">
              {commit.subject}
            </span>
            <span className="flex gap-1.5 text-[10.5px] text-muted-foreground">
              <code className="font-mono">{shortOid(commit.oid)}</code>
              <span className="truncate">{commit.author.name}</span>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">
                {formatDistanceToNowStrict(new Date(commit.author.timestamp), {
                  addSuffix: true,
                })}
              </span>
            </span>
            {commit.refs.length > 0 && (
              <span className="flex gap-1 overflow-hidden">
                {commit.refs.map((ref) => (
                  <Badge
                    key={ref}
                    title={ref}
                    variant="secondary"
                    className="h-4 shrink-0"
                  >
                    {historyRefLabel(ref)}
                  </Badge>
                ))}
              </span>
            )}
          </button>
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
