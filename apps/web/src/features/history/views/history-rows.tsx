import { AsyncResult } from 'effect/reactivity';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { HistorySentinel } from '../adapters/history-sentinel';
import type { useHistory } from '../queries/history';
import { CommitRow } from './commit-row';

type History = ReturnType<typeof useHistory>;

export function HistoryRows({
  commits,
  history,
  selected,
  onSelect,
}: {
  commits: History['commits'];
  history: History;
  selected: string;
  onSelect: (oid: string) => void;
}) {
  return (
    <div className="px-1.5 py-2">
      {commits.map((commit) => (
        <CommitRow
          key={commit.oid}
          commit={commit}
          selected={selected === commit.oid}
          onSelect={() => onSelect(commit.oid)}
        />
      ))}
      <HistoryEnd history={history} />
    </div>
  );
}

export function HistoryEnd({ history }: { history: History }) {
  return (
    <>
      {(() => {
        if (history.result.waiting) {
          return (
            <p className="flex items-center gap-2 px-2 py-3 text-2xs text-muted-foreground">
              <Spinner className="size-3.5" />
              Loading older commits…
            </p>
          );
        }
        if (AsyncResult.isFailure(history.result)) {
          return (
            <div className="flex items-center gap-2 px-2 py-2 text-2xs text-muted-foreground">
              <span>Couldn&apos;t load older commits</span>
              <Button size="xs" variant="outline" onClick={history.readMore}>
                Retry
              </Button>
            </div>
          );
        }
        if (history.nextAfter === null || history.nextAfter === undefined) {
          return (
            <p className="px-2 py-3 text-2xs text-muted-foreground">
              {(() => {
                if (history.boundary === 'shallow') {
                  return 'Shallow clone: older history is not available.';
                }
                if (history.boundary === 'wide') {
                  return 'Too many branches meet here to continue past this point.';
                }
                return 'Start of history.';
              })()}
            </p>
          );
        }
        return null;
      })()}
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
