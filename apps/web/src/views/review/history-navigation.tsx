import { GitCommitHorizontalIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ReviewScope } from '../../domain/review';
import { useHistory } from '../../query/review';
import { ReviewBoundary } from './review-boundary';
import { ReviewEmpty } from './review-empty';
import { ReviewRow } from './review-row';
export function HistoryNavigation(props: {
  scope: ReviewScope;
  selected: string;
  onSelect: (oid: string) => void;
}) {
  const [cursor, setCursor] = useState<string>();
  return (
    <ReviewBoundary key={cursor ?? 'first'}>
      <HistoryPage {...props} cursor={cursor} onPage={setCursor} />
    </ReviewBoundary>
  );
}
function HistoryPage({
  scope,
  selected,
  onSelect,
  cursor,
  onPage,
}: {
  scope: ReviewScope;
  selected: string;
  onSelect: (oid: string) => void;
  cursor: string | undefined;
  onPage: (cursor: string | undefined) => void;
}) {
  const history = useHistory(scope, cursor);
  return (
    <div className="flex flex-col gap-2">
      {history.commits.length ? (
        history.commits.map((commit) => (
          <ReviewRow
            key={commit.oid}
            label={commit.subject}
            detail={`${commit.oid.slice(0, 7)} · ${commit.author.name}`}
            selected={selected === commit.oid}
            onSelect={() => onSelect(commit.oid)}
            icon={<GitCommitHorizontalIcon />}
          />
        ))
      ) : (
        <ReviewEmpty
          title="No commits yet"
          description="Commits will appear here once this worktree has history."
        />
      )}
      {history.boundary && (
        <p className="px-3 text-xs text-muted-foreground">
          Shallow history: older commits may be unavailable.
        </p>
      )}
      <div className="flex gap-2 p-3">
        {cursor && (
          <Button variant="outline" size="sm" onClick={() => onPage(undefined)}>
            Latest
          </Button>
        )}
        {history.nextCursor && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPage(history.nextCursor ?? undefined)}
          >
            Older commits
          </Button>
        )}
      </div>
    </div>
  );
}
