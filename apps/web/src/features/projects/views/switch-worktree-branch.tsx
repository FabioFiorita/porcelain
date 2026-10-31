import { useState } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { CheckIcon, GitBranchIcon } from 'lucide-react';
import { worktreeBranchChoices } from '@porcelain/client/projects/rules';
import { useBranchBases } from '@/features/changes';
import { useInventory } from '../queries/inventory';
import { TruncatedText } from '@/shared/views/truncated-text';
import { Button } from '@/components/ui/button';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import type { Connection } from '@/shared/workspace/connection';
import type { NavigatorEntry } from '@porcelain/client/projects/rules';
import { switchWorktreeBranchDialog } from '../overlays';
import { useSwitchWorktreeBranchAction } from '../commands/worktree-actions';

export function SwitchWorktreeBranchDialog() {
  return (
    <DialogPrimitive.Root handle={switchWorktreeBranchDialog}>
      {({ payload }) =>
        payload && (
          <SwitchWorktreeBranchContent key={payload.requestId} {...payload} />
        )
      }
    </DialogPrimitive.Root>
  );
}
function SwitchWorktreeBranchContent({
  connection,
  entry,
  worktreeId,
}: {
  connection: Connection;
  entry: NavigatorEntry;
  worktreeId: string;
}) {
  const [chosen, setChosen] = useState<string>();
  const {
    result: outcome,
    pending,
    unresolved,
    submit,
  } = useSwitchWorktreeBranchAction({
    connection,
    scope: { projectId: entry.projectId, worktreeId },
  });
  const { result: branches } = useBranchBases(
    { projectId: entry.projectId, worktreeId },
    connection,
    true,
  );
  const answer = Option.getOrUndefined(AsyncResult.value(branches));
  const project = useInventory(connection).projects.find(
    (project) => project.id === entry.projectId,
  );
  const choices = worktreeBranchChoices(
    answer?.bases ?? [],
    project?.worktrees ?? [],
    worktreeId,
  );
  const eligible = choices.some(
    (branch) => branch.ref === chosen && !branch.current && !branch.inUse,
  );
  let actionLabel = 'Switch branch';
  if (unresolved) actionLabel = 'Check outcome';
  if (pending) actionLabel = 'Checking switch';
  return (
    <DialogContent showCloseButton={!pending}>
      <DialogHeader>
        <DialogTitle>Switch branch</DialogTitle>
        <DialogDescription>
          Choose a branch for {entry.name}. Branches used by another worktree
          are unavailable.
        </DialogDescription>
      </DialogHeader>
      <Command>
        <CommandInput aria-label="Find a branch" placeholder="Find a branch" />
        <CommandList aria-label="Branches">
          {AsyncResult.isInitial(branches) && (
            <p role="status" className="p-3 text-xs text-muted-foreground">
              Reading branches
            </p>
          )}
          {AsyncResult.isFailure(branches) && (
            <p role="alert" className="p-3 text-xs text-muted-foreground">
              Branches could not be read.
            </p>
          )}
          {answer && <CommandEmpty>No matching branch</CommandEmpty>}
          <CommandGroup>
            {choices.map((branch) => (
              <CommandItem
                key={branch.ref}
                value={branch.name}
                disabled={
                  pending || unresolved || branch.current || branch.inUse
                }
                onSelect={() => setChosen(branch.ref)}
                data-checked={chosen === branch.ref}
                className="cursor-pointer"
              >
                <GitBranchIcon />
                <TruncatedText text={branch.name} className="min-w-0 flex-1" />
                {branch.current && (
                  <span className="text-muted-foreground">Current</span>
                )}
                {branch.inUse && (
                  <span className="text-muted-foreground">In use</span>
                )}
                {chosen === branch.ref && <CheckIcon />}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
      {unresolved && (
        <p role="status">
          The previous switch is not confirmed. Check its outcome before
          switching again.
        </p>
      )}
      {AsyncResult.isFailure(outcome) && (
        <p role="alert" className="text-xs text-destructive">
          {String(Cause.squash(outcome.cause))}
        </p>
      )}
      {AsyncResult.isSuccess(outcome) &&
        outcome.value.state !== 'succeeded' &&
        outcome.value.state !== 'no-change' && (
          <p role="alert" className="text-xs text-destructive">
            {outcome.value.message ?? 'The branch could not be switched.'}
          </p>
        )}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />} disabled={pending}>
          Cancel
        </DialogClose>
        <Button
          disabled={pending || (!unresolved && !eligible)}
          onClick={() =>
            void submit(chosen, () => switchWorktreeBranchDialog.close())
          }
        >
          {actionLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
