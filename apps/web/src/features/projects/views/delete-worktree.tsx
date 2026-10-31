import { useState } from 'react';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';
import {
  worktreeCleanupOptions,
  worktreeCleanupFields,
  worktreeCleanupDescription,
  worktreeCleanupFailureMessage,
} from '@porcelain/client/projects/rules';
import type { WorktreeCleanupPlan } from '@porcelain/client/projects';
import type { Connection } from '@/shared/workspace/connection';
import type { NavigatorEntry } from '@porcelain/client/projects/rules';
import type { ReviewGitSettings } from '@porcelain/client/preferences';
import {
  confirmedReviewGitSettings,
  reviewGitSettingsBlock,
} from '@porcelain/client/preferences/rules';
import { useReviewGitSettings } from '@/features/preferences';
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
import { deleteWorktreeDialog } from '../overlays';
import { useDeleteWorktreeAction } from '../commands/worktree-actions';

export function DeleteWorktreeDialog() {
  return (
    <AlertDialogPrimitive.Root handle={deleteWorktreeDialog}>
      {({ payload }) =>
        payload && (
          <DeleteWorktreeContent key={payload.requestId} {...payload} />
        )
      }
    </AlertDialogPrimitive.Root>
  );
}
function DeleteWorktreeContent({
  entry,
  connection,
  worktreeId,
}: {
  entry: NavigatorEntry;
  connection: Connection;
  worktreeId: string;
}) {
  const view = useReviewGitSettings(connection);
  const settings = confirmedReviewGitSettings(view);
  const block = reviewGitSettingsBlock(view);
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {entry.name}?</AlertDialogTitle>
        <AlertDialogDescription>
          Choose what to delete this time. Your saved settings won’t change.
          Review history stays available.
        </AlertDialogDescription>
      </AlertDialogHeader>
      {settings ? (
        <DeleteOptions
          settings={settings}
          entry={entry}
          connection={connection}
          worktreeId={worktreeId}
        />
      ) : (
        <p role="status" className="text-xs text-muted-foreground">
          {block ?? 'Reading deletion settings…'}
        </p>
      )}
      {!settings && <AlertDialogCancel>Cancel</AlertDialogCancel>}
    </AlertDialogContent>
  );
}
function DeleteOptions({
  settings,
  entry,
  connection,
  worktreeId,
}: {
  settings: ReviewGitSettings;
  entry: NavigatorEntry;
  connection: Connection;
  worktreeId: string;
}) {
  const { detached } = entry;
  const [options, setOptions] = useState(() =>
    worktreeCleanupOptions(settings, detached),
  );
  const [plan, setPlan] = useState<WorktreeCleanupPlan>();
  const [discardChanges, setDiscardChanges] = useState(false);
  const { result, submit } = useDeleteWorktreeAction(
    { connection, scope: { projectId: entry.projectId, worktreeId } },
    entry,
    () => deleteWorktreeDialog.close(),
  );
  const confirm = () =>
    void submit(
      { options, ...(plan ? { confirmation: { plan, discardChanges } } : {}) },
      setPlan,
      () => {
        setPlan(undefined);
        setDiscardChanges(false);
      },
    );
  const pending = result.waiting;
  const selected = Object.values(options).some(Boolean);
  const risk = plan && (plan.dirty || plan.unpushed);
  const nothingToDelete =
    plan && !plan.worktreePath && !plan.localBranch && !plan.remoteBranch;
  let actionLabel = 'Review deletion';
  if (plan) actionLabel = 'Delete';
  if (pending) actionLabel = 'Checking';
  return (
    <>
      <div className="flex flex-col gap-3">
        {worktreeCleanupFields.map(({ key, label }) => (
          <Field key={key} orientation="horizontal">
            <FieldLabel htmlFor={`delete-${key}`}>{label}</FieldLabel>
            <Switch
              id={`delete-${key}`}
              checked={options[key]}
              disabled={pending || (detached && key !== 'deleteWorktree')}
              onCheckedChange={(checked) => {
                setOptions((current) => ({ ...current, [key]: checked }));
                setPlan(undefined);
                setDiscardChanges(false);
              }}
              className="cursor-pointer"
            />
          </Field>
        ))}
        {detached && (
          <p className="text-xs text-muted-foreground">
            This worktree is detached: there is no checked-out branch to delete.
          </p>
        )}
        {!detached && !options.deleteWorktree && options.deleteLocalBranch && (
          <p className="text-xs text-muted-foreground">
            Keep the worktree folder and its files, detach it from the branch,
            then delete the local branch.
          </p>
        )}
        {!detached && options.deleteWorktree && !options.deleteLocalBranch && (
          <p className="text-xs text-muted-foreground">
            The worktree folder will be deleted. The local branch will be kept.
          </p>
        )}
      </div>
      {plan ? (
        <p className="whitespace-pre-wrap break-all text-xs text-muted-foreground">
          {worktreeCleanupDescription(plan)}
        </p>
      ) : (
        <p className="break-all text-xs text-muted-foreground">{entry.path}</p>
      )}
      {risk && (
        <Field orientation="horizontal">
          <FieldLabel htmlFor="delete-discard-changes">
            I understand the risk of losing changes and commits
          </FieldLabel>
          <Switch
            id="delete-discard-changes"
            checked={discardChanges}
            disabled={pending}
            onCheckedChange={setDiscardChanges}
            className="cursor-pointer"
          />
        </Field>
      )}
      {AsyncResult.isFailure(result) && (
        <p role="alert" className="text-xs text-destructive">
          {worktreeCleanupFailureMessage(Cause.squash(result.cause))}
        </p>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <Button
          variant={plan ? 'destructive' : 'default'}
          disabled={
            pending ||
            !selected ||
            Boolean(nothingToDelete || (risk && !discardChanges))
          }
          onClick={confirm}
        >
          {actionLabel}
        </Button>
      </AlertDialogFooter>
    </>
  );
}
