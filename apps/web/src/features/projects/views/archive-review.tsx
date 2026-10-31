import { ContextMenuItem } from '@/components/ui/context-menu';
import { useState } from 'react';
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';
import { archiveReviewDialog } from '../overlays';
import { AsyncResult } from 'effect/reactivity';
import { Cause } from 'effect';
import type { Connection } from '@/shared/workspace/connection';
import {
  confirmedReviewGitSettings,
  reviewGitSettingsBlock,
} from '@porcelain/client/preferences/rules';
import {
  archiveDescription,
  archiveFailureMessage,
  archiveOptions,
} from '@porcelain/client/projects/rules';
import { useReviewGitSettings } from '@/features/preferences';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  menuItem = false,
}: {
  connection: Connection;
  reviewId: string;
  beforeLeave?: () => void;
  menuItem?: boolean;
}) {
  const view = useReviewGitSettings(connection);
  const settings = confirmedReviewGitSettings(view);
  const block = reviewGitSettingsBlock(view);
  const { submit } = useArchiveReview(connection, reviewId);
  const open = () => {
    if (!settings) return;
    const options = archiveOptions(settings);
    archiveReviewDialog.openWithPayload({
      connection,
      reviewId,
      options,
      requestId: crypto.randomUUID(),
      beforeLeave,
    });
    void submit({ options });
  };
  if (menuItem)
    return (
      <ContextMenuItem disabled={!settings} onClick={open}>
        <span className="flex min-w-0 flex-col">
          Archive
          {!settings && block && (
            <span className="text-xs whitespace-normal text-muted-foreground">
              {block}
            </span>
          )}
        </span>
      </ContextMenuItem>
    );
  const button = (
    <Button
      variant="outline"
      size="sm"
      disabled={!settings}
      focusableWhenDisabled
      onClick={open}
    >
      Archive
    </Button>
  );
  if (settings || !block) return button;
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{block}</TooltipContent>
    </Tooltip>
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
