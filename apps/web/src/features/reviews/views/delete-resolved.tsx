import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useDeleteResolvedComments } from '../commands/comments';
import {
  type CommentThread,
  type ConfirmedThreads,
  resolvedCleanup,
} from '@porcelain/client/reviews/rules';
import {
  reviewErrorMessage,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';

function threadCount(count: number) {
  return count === 1 ? '1 resolved thread' : `${count} resolved threads`;
}

export function DeleteResolved({
  scope,
  context,
  threads,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  threads: readonly CommentThread[];
}) {
  const [confirming, setConfirming] = useState<ConfirmedThreads | null>(null);
  const remove = useDeleteResolvedComments(scope, context);
  const { confirmed, kept } = resolvedCleanup(threads);
  const skipped =
    Option.getOrUndefined(AsyncResult.value(remove.result))?.skipped.length ??
    0;
  const close = () => setConfirming(null);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="ml-auto"
        disabled={confirmed.length === 0}
        onClick={() => {
          remove.reset();
          setConfirming(confirmed);
        }}
      >
        <Trash2Icon data-icon="inline-start" />
        Delete resolved
      </Button>
      <AlertDialog
        open={
          confirming !== null &&
          !(AsyncResult.isSuccess(remove.result) && skipped === 0)
        }
        onOpenChange={(next) => {
          if (!next && !remove.result.waiting) close();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {AsyncResult.isSuccess(remove.result)
                ? `Kept ${skipped === 1 ? '1 thread' : `${skipped} threads`} that changed`
                : `Delete ${threadCount(confirming?.length ?? 0)}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {AsyncResult.isSuccess(remove.result)
                ? 'The agent answered or someone reopened them after you confirmed, so they stay for you to read first.'
                : `This deletes the resolved threads you started, with the agent's replies in them, for you and for the agent.${
                    kept > 0
                      ? ` ${threadCount(kept)} the agent started ${kept === 1 ? 'stays' : 'stay'}, since you cannot delete what the agent wrote on its own.`
                      : ''
                  }`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {AsyncResult.isFailure(remove.result) && (
            <p role="alert" className="text-xs text-destructive">
              {reviewErrorMessage(Cause.squash(remove.result.cause))}
            </p>
          )}
          <AlertDialogFooter>
            {AsyncResult.isSuccess(remove.result) ? (
              <Button onClick={close}>Close</Button>
            ) : (
              <>
                <AlertDialogCancel disabled={remove.result.waiting}>
                  Cancel
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={remove.result.waiting}
                  onClick={() => remove.send(confirming ?? [])}
                >
                  {remove.result.waiting ? 'Deleting…' : 'Delete'}
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
