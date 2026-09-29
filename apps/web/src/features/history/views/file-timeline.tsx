import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { useAccessStore } from '@/features/access/index';
import { useFileTimeline } from '../queries/file-timeline';
import { timelineChange } from '../rules/commit';
import type { HistoryScope } from '../rules/connection';
import { CommitRow } from './commit-row';

export function FileTimeline({
  scope,
  path,
  onSelect,
}: {
  scope: HistoryScope;
  path: string;
  onSelect: (commit: { oid: string; path: string }) => void;
}) {
  const connection = useAccessStore((state) => state.connection);
  const timeline = useFileTimeline(connection, scope, path);
  if (timeline.commits.length === 0)
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
    <ol aria-label={`Timeline of ${path}`} className="flex flex-col p-2">
      {timeline.commits.map((entry) => (
        <li key={entry.commit.oid}>
          <CommitRow
            commit={entry.commit}
            selected={false}
            onSelect={() =>
              onSelect({ oid: entry.commit.oid, path: entry.path })
            }
          >
            <span className="truncate text-[10.5px] text-muted-foreground">
              {timelineChange(entry, path)}
            </span>
          </CommitRow>
        </li>
      ))}
      <li className="px-2 py-3 text-[11px] text-muted-foreground">
        {timeline.more
          ? `Showing the latest ${timeline.commits.length} commits.`
          : 'Start of this file’s history.'}
      </li>
    </ol>
  );
}
