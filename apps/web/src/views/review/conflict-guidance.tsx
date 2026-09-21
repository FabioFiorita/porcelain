import { CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReviewScope } from '../../domain/review';
import { useReviewOverview } from '../../query/review';
import { copyText } from '../workspace/copy';

export function ConflictGuidance({
  scope,
  onOpen,
}: {
  scope: ReviewScope;
  onOpen: (entry: { kind: 'file'; path: string }) => void;
}) {
  const overview = useReviewOverview(scope);
  const state = overview?.changes.inProgress;
  if (!state) return null;
  const conflicts = overview.changes.changes.filter((file) =>
    file.comparisons.some((change) => change.scope === 'unmerged'),
  );
  return (
    <section
      aria-label={`${state === 'merge' ? 'Merge' : 'Rebase'} recovery`}
      className="shrink-0 space-y-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs"
    >
      <p className="font-medium">
        {state === 'merge' ? 'Merge' : 'Rebase'}{' '}
        {conflicts.length
          ? 'is waiting for conflict resolution'
          : 'is ready to finish'}
      </p>
      {conflicts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {conflicts.map((file) => (
            <Button
              key={file.path}
              size="xs"
              variant="outline"
              onClick={() => onOpen({ kind: 'file', path: file.path })}
            >
              {file.path}
            </Button>
          ))}
        </div>
      )}
      <p>
        Resolve the files in your editor or with your agent.{' '}
        {state === 'merge' && overview.changes.mergeHeadOid
          ? 'Use Commit from the Git menu to finish. The merge commit includes every staged resolution.'
          : 'Stage the resolved files, then continue in a terminal in this worktree.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {state === 'rebase' && <Command command="git rebase --continue" />}
        {state === 'merge' && !overview.changes.mergeHeadOid && (
          <Command command="git commit" />
        )}
        <span>To back out:</span>
        <Command command={`git ${state} --abort`} />
      </div>
    </section>
  );
}

function Command({ command }: { command: string }) {
  return (
    <Button
      size="xs"
      variant="outline"
      aria-label={`Copy ${command}`}
      onClick={() => copyText(command, 'command')}
    >
      <code>{command}</code>
      <CopyIcon />
    </Button>
  );
}
