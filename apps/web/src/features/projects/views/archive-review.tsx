import { useState } from 'react';
import { AsyncResult } from 'effect/reactivity';
import { Cause } from 'effect';
import type { Connection } from '@/shared/workspace/connection';
import { archiveOptions } from '@porcelain/client/preferences/rules';
import { archiveDescription } from '@porcelain/client/reviews/rules';
import { usePreferences } from '@/features/preferences';
import { useArchiveReview } from '../commands/archive-review';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
export function ArchiveReview({
  connection,
  reviewId,
}: {
  connection: Connection;
  reviewId: string;
}) {
  const { preferences } = usePreferences();
  const { result, submit } = useArchiveReview(connection, reviewId);
  const [open, setOpen] = useState(false);
  const [discardChanges, setDiscardChanges] = useState(false);
  const answer = AsyncResult.isSuccess(result) ? result.value : undefined;
  const plan = answer?.plan;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
          setDiscardChanges(false);
          void submit({ options: archiveOptions(preferences) });
        }}
      >
        Archive
      </Button>
      <AlertDialog open={open && !answer?.archived} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive review?</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap break-all">
              {plan
                ? archiveDescription(plan)
                : 'Checking the worktree and branches…'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {AsyncResult.isFailure(result) ? (
            <p role="alert">{String(Cause.squash(result.cause))}</p>
          ) : null}
          {plan && (plan.dirty || plan.unpushed) ? (
            <label className="flex items-center gap-2">
              <Switch
                checked={discardChanges}
                onCheckedChange={setDiscardChanges}
                aria-label="I understand the risk of losing changes and commits"
              />
              I understand the risk of losing changes and commits
            </label>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={result.waiting}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={
                result.waiting ||
                !plan ||
                ((plan.dirty || plan.unpushed) && !discardChanges)
              }
              onClick={() => {
                if (plan)
                  void submit({
                    options: archiveOptions(preferences),
                    confirmation: { plan, discardChanges },
                  });
              }}
            >
              {result.waiting ? 'Checking…' : 'Archive review'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
