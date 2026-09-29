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
import { type CommentThread, resolvedCleanup } from '../rules/comments';
import { reviewErrorMessage, type ReviewScope } from '../rules/review';
import type { ReviewsContext } from '../rules/reviewed';

function threadCount(count: number) {
  return count === 1 ? '1 resolved thread' : `${count} resolved threads`;
}

export function DeleteResolved({
  scope,
  context,
  threads,
}: {
  scope: ReviewScope;
  context: ReviewsContext;
  threads: readonly CommentThread[];
}) {
  const [open, setOpen] = useState(false);
  const remove = useDeleteResolvedComments(scope, context);
  const { deleted, kept } = resolvedCleanup(threads);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="ml-auto"
        disabled={deleted === 0}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon data-icon="inline-start" />
        Delete resolved
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!remove.isPending) setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {threadCount(deleted)}?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This deletes the resolved threads you started, with the agent's replies in them, for you and for the agent.${
                kept > 0
                  ? ` ${threadCount(kept)} the agent started ${kept === 1 ? 'stays' : 'stay'}, since you cannot delete what the agent wrote on its own.`
                  : ''
              }`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {remove.error != null && (
            <p role="alert" className="text-xs text-destructive">
              {reviewErrorMessage(remove.error)}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.send(undefined, () => setOpen(false))}
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
