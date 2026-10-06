import { AsyncResult } from 'effect/reactivity';
import { Cause, Option } from 'effect';
import { Button } from '@/components/ui/button';
import { useReviewOverview } from '@/features/changes/index';
import type { GitScope } from '@porcelain/client/git-actions/rules';
import { useDismissInterrupted } from '../commands/dismiss-interrupted';
import { gitErrorMessage } from '@porcelain/client/git-actions/rules';

export function InterruptedActionNotice({
  scope,
  context,
}: {
  scope: GitScope;
  context: Parameters<typeof useDismissInterrupted>[1];
}) {
  const { connection } = context;
  const overview = Option.getOrUndefined(
    AsyncResult.value(useReviewOverview(scope, connection)),
  );
  const dismiss = useDismissInterrupted(scope, context);
  const interrupted = overview?.interrupted;
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
        {AsyncResult.isFailure(dismiss.result) && (
          <p role="alert" className="mt-1 text-destructive">
            {gitErrorMessage(Cause.squash(dismiss.result.cause))}
          </p>
        )}
      </div>
      <Button
        size="xs"
        variant="ghost"
        disabled={dismiss.result.waiting}
        onClick={() => dismiss.dismiss(interrupted.requestId)}
      >
        Got it
      </Button>
    </div>
  );
}
