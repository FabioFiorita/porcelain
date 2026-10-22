import { useReviewDeletion } from '../commands/project-review';
import { useState } from 'react';
import { useAtom } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { reviewCommands } from '@porcelain/client/reviews';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { ConnectionContext } from '@/shared/workspace/connection';

export function ReviewActions({
  reviewId,
  state,
  context,
  onDeleted,
}: {
  reviewId: string;
  state: 'open' | 'closed';
  context: ConnectionContext;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const commands = reviewCommands({ connection: context.connection, reviewId });
  const [closed, close] = useAtom(commands.close);
  const deletion = useReviewDeletion(reviewId, context);
  const removed = deletion.result;
  const pending = closed.waiting || removed.waiting;
  return (
    <AlertDialog
      open={confirming}
      onOpenChange={(open) => {
        if (!removed.waiting) setConfirming(open);
      }}
    >
      <div className="flex flex-col items-start gap-1">
        {state === 'open' && (
          <Button
            size="xs"
            variant="ghost"
            disabled={pending}
            onClick={() => close()}
          >
            Close review
          </Button>
        )}
        <AlertDialogTrigger
          disabled={pending}
          render={<Button size="xs" variant="destructive" />}
        >
          Delete review…
        </AlertDialogTrigger>
      </div>
      {AsyncResult.isFailure(closed) && (
        <p role="alert" className="text-sm text-destructive">
          The review could not be closed. Try again.
        </p>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete review?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes every revision, proof asset, comment and
            mark owned by this review for everyone connected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {AsyncResult.isFailure(removed) && (
          <p role="alert" className="text-sm text-destructive">
            The review could not be deleted. Try again.
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removed.waiting}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={removed.waiting}
            onClick={() => {
              deletion.send(undefined, () => {
                setConfirming(false);
                onDeleted();
              });
            }}
          >
            {removed.waiting ? 'Deleting…' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
