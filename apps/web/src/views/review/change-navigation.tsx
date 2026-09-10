import { Badge } from '@/components/ui/badge';
import {
  changeKey,
  changePath,
  groupChanges,
  type ReviewScope,
} from '../../domain/review';
import { useChanges } from '../../query/review';
import { ReviewEmpty } from './review-empty';
import { ReviewRow } from './review-row';
export function ChangeNavigation({
  scope,
  selected,
  onSelect,
}: {
  scope: ReviewScope;
  selected: string;
  onSelect: (key: string) => void;
}) {
  const { status, layers } = useChanges(scope);
  if (!status.changes.length)
    return (
      <ReviewEmpty
        title="All caught up"
        description="This worktree has no uncommitted changes."
      />
    );
  return (
    <div className="flex flex-col gap-3">
      {groupChanges(status, layers).map((group, index) => (
        <section key={group.id}>
          <div className="mb-1 flex items-center gap-2 px-2">
            <span className="text-xs tabular-nums text-muted-foreground">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3
              className="min-w-0 flex-1 truncate text-xs font-medium"
              title={group.title}
            >
              {group.title}
            </h3>
            <span className="text-xs text-muted-foreground">
              {group.changes.length}
            </span>
          </div>
          {group.changes.map((change) => (
            <ReviewRow
              key={changeKey(change)}
              label={changePath(change).split('/').at(-1) ?? ''}
              detail={`${changePath(change)} · ${change.scope}`}
              selected={selected === changeKey(change)}
              onSelect={() => onSelect(changeKey(change))}
              badge={
                <Badge variant="secondary">
                  {'kind' in change ? change.kind : change.scope}
                </Badge>
              }
            />
          ))}
        </section>
      ))}
      <p className="px-2 text-xs leading-relaxed text-muted-foreground">
        Review layers preserve the author’s order. Unassigned changes remain
        visible.
      </p>
    </div>
  );
}
