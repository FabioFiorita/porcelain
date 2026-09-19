import { formatDistanceToNowStrict } from 'date-fns';
import { GitBranch, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { entryKey } from '../../domain/documents';
import {
  type GraphRow,
  historyFollows,
  layoutGraph,
  shortOid,
} from '../../domain/history';
import type { ReviewScope } from '../../domain/review';
import { discardRejection } from '../../query/mutation';
import { useHistory } from '../../query/review';
import type { OpenDocument } from './review-workspace';

const ROW = 58;
const LANE = 16;
const LEFT = 13;
const LANE_COLORS = [
  'var(--graph-lane-1)',
  'var(--graph-lane-2)',
  'var(--graph-lane-3)',
  'var(--graph-lane-4)',
];
const laneX = (lane: number) => LEFT + lane * LANE;
const color = (lane: number) => LANE_COLORS[lane % LANE_COLORS.length];

/**
 * The rightmost lane the graph draws in: a dot, or a line passing a row. A merge's
 * other parent can sit pages further down, so its line runs in a lane no loaded
 * commit has a dot in yet.
 */
const widestLane = (rows: readonly GraphRow[]) =>
  Math.max(
    0,
    ...rows.map((row) =>
      Math.max(
        row.lane,
        row.lanesAfter.findLastIndex((waiting) => waiting != null),
      ),
    ),
  );

/** Long enough to read, short enough not to linger over a list that already moved on. */
const REWRITTEN_NOTE_MS = 12_000;

type Props = {
  scope: ReviewScope;
  activeEntry: string | undefined;
  onOpen: OpenDocument;
};

/**
 * The checked-out branch, newest first, with its graph. Pages are "commits
 * before the last one shown", so new commits arriving on top (announced by the
 * live channel when the branch moves) never shift the pages below. Nothing polls.
 */
export function HistorySurface({ scope, activeEntry, onOpen }: Props) {
  const history = useHistory(scope);
  const rows = layoutGraph(history.commits);
  const width = LEFT * 2 + widestLane(rows) * LANE;
  const top = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const {
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = history;

  // A rebase or reset took away the commit an older page started from, so the list
  // restarted from the newest commit (`rewrittenAt`). The note stays a little while
  // or until dismissed, and the list goes back to the top where it restarted.
  const { rewrittenAt } = history;
  const [noteDoneFor, setNoteDoneFor] = useState<number | null>(null);
  const rewrittenNote = rewrittenAt != null && noteDoneFor !== rewrittenAt;
  useEffect(() => {
    if (rewrittenAt == null) return;
    top.current
      ?.closest('[data-slot=scroll-area-viewport]')
      ?.scrollTo({ top: 0 });
    const timer = setTimeout(
      () => setNoteDoneFor(rewrittenAt),
      Math.max(0, rewrittenAt + REWRITTEN_NOTE_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [rewrittenAt]);

  // Load older commits once the end of the list is near. A new observer reports
  // right away, so a first page too short to scroll keeps filling. After a
  // failure it waits for Retry instead of looping.
  useEffect(() => {
    const element = sentinel.current;
    if (
      element == null ||
      !hasNextPage ||
      isFetchingNextPage ||
      isFetchNextPageError
    )
      return;
    // A null root still sees through the ScrollArea viewport clipping the sentinel.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) discardRejection(fetchNextPage());
      },
      { rootMargin: '0px 0px 240px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {history.head != null && (
        <p className="flex shrink-0 items-center gap-1.5 border-b px-3.5 py-2 text-[11.5px] text-muted-foreground">
          <GitBranch className="size-3.5 shrink-0" />
          <span className="truncate">{historyFollows(history.head)}</span>
        </p>
      )}
      <div role="status" aria-live="polite" className="contents">
        {rewrittenNote && (
          <div className="flex shrink-0 items-start gap-2 border-b bg-muted/60 py-2 pr-1.5 pl-3.5 text-[11.5px] text-muted-foreground">
            <RotateCcw className="mt-px size-3.5 shrink-0" />
            <p className="min-w-0 flex-1">
              The branch was rewritten; showing it from the newest commit.
            </p>
            <Button
              size="icon-xs"
              variant="ghost"
              className="-my-0.5 text-muted-foreground"
              aria-label="Dismiss"
              onClick={() => setNoteDoneFor(rewrittenAt)}
            >
              <X />
            </Button>
          </div>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div ref={top} className="flex px-1.5 py-2">
          <Graph rows={rows} width={width} />
          <div className="min-w-0 flex-1">
            {rows.map(({ commit }) => {
              const ref = { kind: 'commit', oid: commit.oid } as const;
              return (
                <button
                  type="button"
                  key={commit.oid}
                  style={{ height: ROW }}
                  onClick={() => onOpen(ref)}
                  className={cn(
                    'flex w-full flex-col justify-center gap-0.5 rounded-lg px-2 text-left transition-colors hover:bg-accent',
                    activeEntry === entryKey(ref) && 'bg-accent',
                  )}
                >
                  <span className="truncate text-[12.5px] leading-tight">
                    {commit.subject}
                  </span>
                  <span className="flex gap-1.5 text-[10.5px] text-muted-foreground">
                    <code className="font-mono">{shortOid(commit.oid)}</code>
                    <span className="truncate">{commit.author.name}</span>
                    <span>·</span>
                    <span className="shrink-0">
                      {formatDistanceToNowStrict(
                        new Date(commit.author.timestamp),
                        { addSuffix: true },
                      )}
                    </span>
                  </span>
                  {commit.refs != null && commit.refs.length > 0 && (
                    <span className="flex gap-1 overflow-hidden">
                      {commit.refs.map((name) => (
                        <Badge
                          key={name}
                          variant="secondary"
                          className="h-4 shrink-0 px-1.5 text-[9.5px] font-normal"
                        >
                          {name}
                        </Badge>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
            {isFetchingNextPage ? (
              <p className="flex items-center gap-2 px-2 py-3 text-[11px] text-muted-foreground">
                <Spinner className="size-3.5" />
                Loading older commits…
              </p>
            ) : isFetchNextPageError ? (
              <div className="flex items-center gap-2 px-2 py-2 text-[11px] text-muted-foreground">
                Couldn't load older commits
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => discardRejection(fetchNextPage())}
                >
                  Retry
                </Button>
              </div>
            ) : !hasNextPage ? (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">
                {history.boundary === 'shallow'
                  ? 'Shallow clone: older history is not available.'
                  : 'Start of history.'}
              </p>
            ) : null}
            <div ref={sentinel} aria-hidden="true" className="h-px" />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/** Each band between two rows is drawn lane by lane, so branches visibly fan out and merge back. */
function Graph({ rows, width }: { rows: GraphRow[]; width: number }) {
  return (
    <svg
      className="shrink-0"
      width={width}
      height={rows.length * ROW}
      aria-hidden="true"
    >
      {rows.map((row, index) => {
        const y = index * ROW + ROW / 2;
        const next = rows[index + 1];
        const segments = row.lanesAfter.flatMap((waitingFor, lane) => {
          if (waitingFor == null || next == null) return [];
          const startX = row.outgoing.includes(lane)
            ? laneX(row.lane)
            : laneX(lane);
          const endX =
            waitingFor === next.commit.oid ? laneX(next.lane) : laneX(lane);
          return [{ lane, startX, endX }];
        });
        const merge = row.commit.parentOids.length > 1;
        return (
          <g key={row.commit.oid}>
            {segments.map(({ lane, startX, endX }) => (
              <path
                key={lane}
                d={
                  startX === endX
                    ? `M ${startX} ${y} L ${endX} ${y + ROW}`
                    : `M ${startX} ${y} C ${startX} ${y + ROW / 2}, ${endX} ${y + ROW / 2}, ${endX} ${y + ROW}`
                }
                fill="none"
                stroke={color(lane)}
                strokeWidth={1.5}
              />
            ))}
            <circle
              cx={laneX(row.lane)}
              cy={y}
              r={merge ? 5 : 4}
              fill={merge ? 'var(--card)' : color(row.lane)}
              stroke={color(row.lane)}
              strokeWidth={2}
            />
          </g>
        );
      })}
    </svg>
  );
}
