import { TruncatedText } from '@/shared/views/truncated-text';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { useFileTimeline } from '../queries/file-timeline';
import { timelineChange } from '@porcelain/client/history/rules';
import type { HistoryScope } from '@porcelain/client/history/rules';
import { CommitRow } from './commit-row';
import { type Connection } from '@/shared/workspace/connection';
import { Button } from '@/components/ui/button';
import { AsyncResult } from 'effect/reactivity';
import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { historyPlace } from '@porcelain/client/history';
import { useHistoryScroll } from '../adapters/history-scroll';

export function FileTimeline({
  scope,
  connection,
  path,
  onSelect,
  sideLabel,
}: {
  scope: HistoryScope;
  connection: Connection;
  path: string;
  onSelect: (commit: { oid: string; path: string }, toSide?: boolean) => void;
  sideLabel: string;
}) {
  const timeline = useFileTimeline(connection, scope, path);
  const place = historyPlace({ connection, scope, kind: 'file', path });
  const selected = useAtomValue(place, (current) => current.selected);
  const setPlace = useAtomSet(place);
  const scroll = useHistoryScroll(place);
  const open = (entry: (typeof timeline.commits)[number], toSide?: boolean) => {
    setPlace((current) => ({ ...current, selected: entry.commit.oid }));
    onSelect({ oid: entry.commit.oid, path: entry.path }, toSide);
  };
  if (timeline.commits.length === 0 && timeline.nextAfter === null)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No commits touch this file</EmptyTitle>
          <EmptyDescription>
            Its timeline starts with the first commit that includes it.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <div
      role="region"
      aria-label="Timeline reading area"
      className="min-h-0 flex-1 overflow-auto"
      {...scroll}
    >
      <ol aria-label={`Timeline of ${path}`} className="flex flex-col p-2">
        {timeline.commits.map((entry) => (
          <li key={entry.commit.oid}>
            <CommitRow
              commit={entry.commit}
              selected={selected === entry.commit.oid}
              onSelect={(toSide) => open(entry, toSide)}
              openToSide={{
                label: sideLabel,
                open: () => open(entry, true),
              }}
            >
              <TruncatedText
                className="text-2xs text-muted-foreground"
                text={timelineChange(entry, path)}
              />
            </CommitRow>
          </li>
        ))}
        <li className="flex flex-col gap-1 px-2 py-3 text-2xs text-muted-foreground">
          {timeline.restarted && (
            <span role="status">History changed. Showing it from the top.</span>
          )}
          <TimelineStatus timeline={timeline} />
          <span>
            A merge appears only when its own result changed the file.
          </span>
        </li>
      </ol>
    </div>
  );
}

function TimelineStatus({
  timeline,
}: {
  timeline: ReturnType<typeof useFileTimeline>;
}) {
  if (AsyncResult.isFailure(timeline.result))
    return (
      <div role="status">
        Couldn't load older commits
        <Button size="xs" variant="outline" onClick={timeline.readMore}>
          Retry
        </Button>
      </div>
    );
  if (timeline.nextAfter)
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={timeline.result.waiting}
        onClick={timeline.readMore}
      >
        {timeline.result.waiting
          ? 'Loading older commits…'
          : 'Load older commits'}
      </Button>
    );
  return (
    <span>
      {timeline.boundary === 'shallow'
        ? 'Shallow clone: older history is not available.'
        : 'Start of this file’s history.'}
    </span>
  );
}
