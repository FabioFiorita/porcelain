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
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontalIcon } from 'lucide-react';
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Review actions"
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {state === 'open' && (
            <DropdownMenuItem disabled={pending} onClick={() => close()}>
              Close review
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            Delete review
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {AsyncResult.isFailure(closed) && (
        <p role="alert" className="w-full text-sm text-destructive">
          The review could not be closed. Try again.
        </p>
      )}
      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!removed.waiting) setConfirming(open);
        }}
      >
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
    </>
  );
}
