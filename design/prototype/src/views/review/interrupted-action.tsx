import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { ReviewScope } from '../../domain/review';
import { useDismissInterrupted } from '../../query/git-actions';
import { useChanges } from '../../query/review';
import { reportFailure } from '../workspace/notify';

/** What was running, as the start of a sentence. */
const SUBJECTS: Record<string, string> = {
  fetch: 'A fetch',
  pull: 'A pull',
  push: 'A push',
  commit: 'A commit',
  amend: 'Amending the last commit',
  'stash-create': 'Stashing changes',
  'stash-apply': 'Restoring a stash',
  'stash-pop': 'Popping a stash',
  discard: 'Discarding changes',
  'switch-branch': 'Switching branches',
  'create-branch': 'Creating a branch',
};

/**
 * Shown once after a server restart cut a Git action off: what was running and what
 * Git reports now, with Dismiss. Nothing is locked; the project stays usable. Placed
 * at the top of the review workspace.
 */
export function InterruptedActionBanner({ scope }: { scope: ReviewScope }) {
  const { interrupted } = useChanges(scope);
  const dismiss = useDismissInterrupted(scope);
  if (interrupted == null) return null;
  const subject = SUBJECTS[interrupted.action] ?? `A ${interrupted.action}`;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2 border-b bg-amber-500/10 px-3.5 py-1.5 text-[12px] text-amber-800 dark:text-amber-200"
    >
      <TriangleAlert className="size-3.5 shrink-0" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">
          {subject} was interrupted when the server restarted.
        </span>{' '}
        {interrupted.gitState ?? 'Git reports nothing unusual.'}
      </p>
      <Button
        size="xs"
        variant="ghost"
        className="shrink-0 text-inherit hover:bg-amber-500/15 hover:text-inherit dark:hover:bg-amber-500/15"
        disabled={dismiss.isPending}
        onClick={() =>
          reportFailure(
            dismiss.submit(interrupted.requestId),
            'Could not dismiss the notice',
          )
        }
      >
        {dismiss.isPending && <Spinner className="size-3" />}
        Dismiss
      </Button>
    </div>
  );
}
