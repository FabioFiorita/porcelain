import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { MoreHorizontalIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useDeleteReview } from '../commands/publication';
import {
  reviewErrorMessage,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';
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
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function DeleteReview({
  scope,
  context,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
}) {
  const [confirming, setConfirming] = useState(false);
  const { result, send, reset } = useDeleteReview(scope, context);
  return (
    <>
      <div className="flex items-center justify-between px-3 pt-2">
        <span className="text-xs font-medium text-muted-foreground">
          Published review
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Review actions"
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                reset();
                setConfirming(true);
              }}
            >
              <Trash2Icon />
              Delete review
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <AlertDialog
        open={confirming && !AsyncResult.isSuccess(result)}
        onOpenChange={(open) => {
          if (!result.waiting) setConfirming(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete review?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the review, its proof and its reviewed
              decisions for everyone connected. Comments and reviewed file marks
              stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {AsyncResult.isFailure(result) && (
            <p role="alert" className="text-xs text-destructive">
              {reviewErrorMessage(Cause.squash(result.cause))}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={result.waiting}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={result.waiting}
              onClick={() => send()}
            >
              {result.waiting ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
