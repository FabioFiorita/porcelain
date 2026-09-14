import { formatDistanceToNowStrict } from 'date-fns';
import { GitBranchIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { historyFollows, layoutGraph, shortOid } from '../../domain/history';
import type { ReviewScope } from '../../domain/review';
import { discardRejection } from '../../lib/submit-form';
import { useHistory } from '../../query/history';
import {
  HISTORY_ROW_HEIGHT,
  HistoryGraph,
  historyGraphWidth,
} from './history-graph';
import { ReviewBoundary } from './review-boundary';
import { ReviewEmpty } from './review-empty';

export function HistoryNavigation(props: {
  scope: ReviewScope;
  selected: string;
  onSelect: (oid: string) => void;
}) {
  return (
    <ReviewBoundary>
      <HistoryPage {...props} />
    </ReviewBoundary>
  );
}

function HistoryPage({
  scope,
  selected,
  onSelect,
}: {
  scope: ReviewScope;
  selected: string;
  onSelect: (oid: string) => void;
}) {
  const history = useHistory(scope);
  const rows = layoutGraph(history.commits);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = sentinel.current;
    if (
      element == null ||
      !history.hasNextPage ||
      history.isFetchingNextPage ||
      history.isFetchNextPageError ||
      typeof IntersectionObserver === 'undefined'
    )
      return;

    // A null root still observes through the surrounding ScrollArea viewport.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) discardRejection(history.fetchNextPage());
      },
      { rootMargin: '0px 0px 240px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [
    history.fetchNextPage,
    history.hasNextPage,
    history.isFetchNextPageError,
    history.isFetchingNextPage,
  ]);

  return (
    <div className="flex flex-col">
      {history.snapshot != null && (
        <p className="flex shrink-0 items-center gap-1.5 border-b px-3.5 py-2 text-[11.5px] text-muted-foreground">
          <GitBranchIcon className="size-3.5 shrink-0" />
          <span className="truncate">
            {historyFollows(history.snapshot.head)}
          </span>
        </p>
      )}

      {history.commits.length === 0 ? (
        <ReviewEmpty
          title="No commits yet"
          description="Commits will appear here once this worktree has history."
        />
      ) : (
        <div className="flex px-1.5 py-2">
          <HistoryGraph rows={rows} width={historyGraphWidth(rows)} />
          <div className="min-w-0 flex-1">
            {rows.map(({ commit }) => {
              const isSelected = selected === commit.oid;
              return (
                <button
                  type="button"
                  key={commit.oid}
                  style={{ height: HISTORY_ROW_HEIGHT }}
                  aria-pressed={isSelected}
                  title={commit.subject}
                  onClick={() => onSelect(commit.oid)}
                  className={cn(
                    'flex w-full flex-col justify-center gap-0.5 rounded-lg px-2 text-left transition-colors hover:bg-accent',
                    isSelected && 'bg-accent',
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
                      {formatDistanceToNowStrict(
                        new Date(commit.author.timestamp),
                        { addSuffix: true },
                      )}
                    </span>
                  </span>
                </button>
              );
            })}

            {history.isFetchingNextPage ? (
              <p className="flex items-center gap-2 px-2 py-3 text-[11px] text-muted-foreground">
                <Spinner className="size-3.5" />
                Loading older commits…
              </p>
            ) : history.isFetchNextPageError ? (
              <div className="flex items-center gap-2 px-2 py-2 text-[11px] text-muted-foreground">
                <span>Couldn&apos;t load older commits</span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => discardRejection(history.fetchNextPage())}
                >
                  Retry
                </Button>
              </div>
            ) : history.nextCursor == null ? (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">
                {history.boundary === 'shallow'
                  ? 'Shallow clone: older history is not available.'
                  : 'Start of history.'}
              </p>
            ) : null}
            <div ref={sentinel} aria-hidden="true" className="h-px" />
          </div>
        </div>
      )}
    </div>
  );
}
