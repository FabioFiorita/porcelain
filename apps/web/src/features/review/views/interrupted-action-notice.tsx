import { Button } from '@/components/ui/button';
import type { ReviewScope } from '@/features/review/model/review';
import { useDismissInterrupted } from '@/features/review/queries/git-actions';
import { useReviewOverview } from '@/features/review/queries/review';
import { gitErrorMessage } from './git-action-feedback';

export function InterruptedActionNotice({ scope }: { scope: ReviewScope }) {
  const overview = useReviewOverview(scope);
  const dismiss = useDismissInterrupted(scope);
  const interrupted = overview?.changes.interrupted;
  if (!interrupted) return null;
  return (
    <div
      role="status"
      className="flex shrink-0 items-start gap-3 border-b border-graph-4/20 bg-graph-4/10 px-3 py-2 text-xs"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          A Git action was interrupted:{' '}
          {interrupted.action.replaceAll('-', ' ')}
        </p>
        <p className="mt-1 text-muted-foreground">
          Check the current changes before trying again.
        </p>
        {dismiss.error && (
          <p role="alert" className="mt-1 text-destructive">
            {gitErrorMessage(dismiss.error)}
          </p>
        )}
      </div>
      <Button
        size="xs"
        variant="ghost"
        disabled={dismiss.isPending}
        onClick={() =>
          void dismiss.submit(interrupted.requestId).catch(() => {})
        }
      >
        Got it
      </Button>
    </div>
  );
}
