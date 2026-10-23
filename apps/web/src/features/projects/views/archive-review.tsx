import { useState } from 'react';
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';
import { archiveReviewDialog } from '../overlays';
import { AsyncResult } from 'effect/reactivity';
import { Cause } from 'effect';
import type { Connection } from '@/shared/workspace/connection';
import { archiveOptions } from '@porcelain/client/preferences/rules';
import {
  archiveDescription,
  archiveFailureMessage,
} from '@porcelain/client/reviews/rules';
import { usePreferences } from '@/features/preferences';
import { useArchiveReview } from '../commands/archive-review';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Field, FieldLabel } from '@/components/ui/field';
import {
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
  beforeLeave = () => {},
}: {
  connection: Connection;
  reviewId: string;
  beforeLeave?: () => void;
}) {
  const { preferences } = usePreferences();
  const { submit } = useArchiveReview(connection, reviewId);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const options = archiveOptions(preferences);
        archiveReviewDialog.openWithPayload({
          connection,
          reviewId,
          options,
          requestId: crypto.randomUUID(),
          beforeLeave,
        });
        void submit({ options });
      }}
    >
      Archive
    </Button>
  );
}

export function ArchiveReviewDialog() {
  return (
    <AlertDialogPrimitive.Root handle={archiveReviewDialog}>
      {({ payload }) =>
        payload && <ArchiveReviewContent key={payload.requestId} {...payload} />
      }
    </AlertDialogPrimitive.Root>
  );
}

function ArchiveReviewContent({
  connection,
  reviewId,
  options,
  beforeLeave,
}: {
  connection: Connection;
  reviewId: string;
  options: ReturnType<typeof archiveOptions>;
  beforeLeave: () => void;
}) {
  const { result, submit } = useArchiveReview(
    connection,
    reviewId,
    () => archiveReviewDialog.close(),
    beforeLeave,
  );
  const [discardChanges, setDiscardChanges] = useState(false);
  const answer = AsyncResult.isSuccess(result) ? result.value : undefined;
  const plan = answer?.plan;
  let description = 'Checking the worktree and branches…';
  if (AsyncResult.isFailure(result))
    description = 'Archiving could not be completed.';
  if (plan) description = archiveDescription(plan);
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Archive review?</AlertDialogTitle>
        <AlertDialogDescription className="whitespace-pre-wrap [overflow-wrap:anywhere]">
          {description}
        </AlertDialogDescription>
      </AlertDialogHeader>
      {AsyncResult.isFailure(result) ? (
        <p role="alert">{archiveFailureMessage(Cause.squash(result.cause))}</p>
      ) : null}
      {plan && (plan.dirty || plan.unpushed) ? (
        <Field orientation="horizontal">
          <Switch
            checked={discardChanges}
            onCheckedChange={setDiscardChanges}
            id="archive-discard-changes"
          />
          <FieldLabel htmlFor="archive-discard-changes">
            I understand the risk of losing changes and commits
          </FieldLabel>
        </Field>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={result.waiting}>Cancel</AlertDialogCancel>
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
                options,
                confirmation: { plan, discardChanges },
              });
          }}
        >
          {result.waiting ? 'Checking…' : 'Archive review'}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
