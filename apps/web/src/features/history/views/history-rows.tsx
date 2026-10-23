import { HISTORY_GRAPH_ROW_GAP, HISTORY_ROW_HEIGHT } from '@/config/limits';
import { historyBoundary } from '@porcelain/client/history/rules';
import { historyGraphWidth, layoutGraph } from '../rules/graph';
import { AsyncResult } from 'effect/reactivity';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { HistorySentinel } from '../adapters/history-sentinel';
import type { useHistory } from '../queries/history';
import { CommitRow } from './commit-row';
import { HistoryGraph } from './history-graph';

type History = ReturnType<typeof useHistory>;

export function GraphRows({
  label,
  history,
  selected,
  onSelect,
  sideLabel,
}: {
  label: string;
  history: History;
  selected: string;
  onSelect: (oid: string, toSide?: boolean) => void;
  sideLabel: string;
}) {
  const rows = layoutGraph(history.commits);
  const width = historyGraphWidth(rows);
  return (
    <div className="relative px-1.5 py-2">
      <HistoryGraph rows={rows} width={width} />
      <ol aria-label={label} className="flex flex-col">
        {rows.map(({ commit }) => (
          <li key={commit.oid}>
            <CommitRow
              commit={commit}
              selected={selected === commit.oid}
              height={HISTORY_ROW_HEIGHT}
              inset={width + HISTORY_GRAPH_ROW_GAP}
              onSelect={(toSide) => onSelect(commit.oid, toSide)}
              openToSide={{
                label: sideLabel,
                open: () => onSelect(commit.oid, true),
              }}
            />
          </li>
        ))}
      </ol>
      <div style={{ paddingLeft: width }}>
        <HistoryEnd history={history} />
      </div>
    </div>
  );
}

function HistoryEnd({ history }: { history: History }) {
  return (
    <>
      <HistoryStatus history={history} />
      <HistorySentinel
        enabled={
          history.nextAfter !== null &&
          history.nextAfter !== undefined &&
          !history.result.waiting &&
          !AsyncResult.isFailure(history.result)
        }
        onVisible={history.readMore}
      />
    </>
  );
}

function HistoryStatus({ history }: { history: History }) {
  if (history.result.waiting)
    return (
      <p className="flex items-center gap-2 px-2 py-3 text-2xs text-muted-foreground">
        <Spinner className="size-3.5" />
        Loading older commits…
      </p>
    );
  if (AsyncResult.isFailure(history.result))
    return (
      <div className="flex items-center gap-2 px-2 py-2 text-2xs text-muted-foreground">
        <span>Couldn&apos;t load older commits</span>
        <Button size="xs" variant="outline" onClick={history.readMore}>
          Retry
        </Button>
      </div>
    );
  if (history.nextAfter === null || history.nextAfter === undefined)
    return (
      <p className="px-2 py-3 text-2xs text-muted-foreground">
        {historyBoundary(history.boundary)}
      </p>
    );
  return null;
}
