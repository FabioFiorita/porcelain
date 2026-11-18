import { ContextMenuItem } from '@/components/ui/context-menu';
import { useState } from 'react';
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';
import { archivePullRequestDialog } from '../overlays';
import { AsyncResult } from 'effect/reactivity';
import { Cause } from 'effect';
import {
  useWorkspaceWriteBlock,
  type ConnectionContext,
} from '@/shared/workspace/connection';
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
import { useArchivePullRequest } from '../commands/archive-pull-request';
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
export function ArchivePullRequest({
  context,
  projectId,
  number,
  beforeLeave = () => {},
  menuItem = false,
}: {
  context: ConnectionContext;
  projectId: string;
  number: number;
  beforeLeave?: () => void;
  menuItem?: boolean;
}) {
  const { connection } = context;
  const writeBlock = useWorkspaceWriteBlock(context);
  const view = useReviewGitSettings(connection);
  const settings = confirmedReviewGitSettings(view);
  const block = writeBlock ?? reviewGitSettingsBlock(view);
  const { submit } = useArchivePullRequest(connection, projectId, number);
  const open = () => {
    if (!settings || writeBlock) return;
    const options = archiveOptions(settings);
    archivePullRequestDialog.openWithPayload({
      context,
      projectId,
      number,
      options,
      requestId: crypto.randomUUID(),
      beforeLeave,
    });
    void submit({ options });
  };
  if (menuItem)
    return (
      <ContextMenuItem
        disabled={!settings || Boolean(writeBlock)}
        aria-description={writeBlock}
        onClick={open}
      >
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
      disabled={!settings || Boolean(writeBlock)}
      aria-description={writeBlock}
      focusableWhenDisabled
      onClick={open}
    >
      Archive
    </Button>
  );
  if ((settings && !writeBlock) || !block) return button;
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{block}</TooltipContent>
    </Tooltip>
  );
}

export function ArchivePullRequestDialog() {
  return (
    <AlertDialogPrimitive.Root handle={archivePullRequestDialog}>
      {({ payload }) =>
        payload && (
          <ArchivePullRequestContent key={payload.requestId} {...payload} />
        )
      }
    </AlertDialogPrimitive.Root>
  );
}

function ArchivePullRequestContent({
  context,
  projectId,
  number,
  options,
  beforeLeave,
}: {
  context: ConnectionContext;
  projectId: string;
  number: number;
  options: ReturnType<typeof archiveOptions>;
  beforeLeave: () => void;
}) {
  const writeBlock = useWorkspaceWriteBlock(context);
  const { result, submit } = useArchivePullRequest(
    context.connection,
    projectId,
    number,
    () => archivePullRequestDialog.close(),
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
        <AlertDialogTitle>Archive pull request?</AlertDialogTitle>
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
            Boolean(writeBlock) ||
            result.waiting ||
            !plan ||
            ((plan.dirty || plan.unpushed) && !discardChanges)
          }
          aria-description={writeBlock}
          onClick={() => {
            if (plan && !writeBlock)
              void submit({
                options,
                confirmation: { plan, discardChanges },
              });
          }}
        >
          {result.waiting ? 'Checking…' : 'Archive pull request'}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
