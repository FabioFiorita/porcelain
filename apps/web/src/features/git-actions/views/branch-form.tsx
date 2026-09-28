import { GitBranchIcon, GitBranchPlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { gitErrorMessage } from '../rules/feedback';
import { GitActionError } from './git-action-message';
import type { GitActionStatus } from '../rules/status';
import type { useBranchForm } from '../commands/branch-form';

export function BranchForm({
  mode,
  status,
  form,
}: {
  mode: 'switch' | 'create';
  status: GitActionStatus;
  form: ReturnType<typeof useBranchForm>;
}) {
  const {
    branch,
    switchTo,
    branches,
    current,
    lookedBranch,
    aligned,
    choices,
    uncertain,
    busy,
    git,
    error,
    setBranch,
    setSwitchTo,
    submit,
    checkOutcome,
  } = form;
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {mode === 'switch' ? 'Switch branch' : 'Create branch'}
        </DialogTitle>
        <DialogDescription>
          {mode === 'switch'
            ? status.changes.length
              ? `${status.files?.length ?? 0} uncommitted file${status.files?.length === 1 ? '' : 's'} come along unless Git says they would be overwritten.`
              : 'The review follows the branch you choose.'
            : `Starts from ${lookedBranch ?? 'the detached HEAD'}.`}
        </DialogDescription>
      </DialogHeader>
      {mode === 'switch' ? (
        branches.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Listing branches…
          </p>
        ) : branches.error ? (
          <p role="alert" className="text-sm text-destructive">
            {gitErrorMessage(branches.error)}
          </p>
        ) : !aligned ? (
          <p role="status" className="text-sm text-muted-foreground">
            Updating branch status…
          </p>
        ) : (
          <NativeSelect
            aria-label="Branch"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
          >
            <NativeSelectOption value="">Choose a branch</NativeSelectOption>
            {choices.map((choice) => (
              <NativeSelectOption
                key={choice.name}
                value={choice.name}
                disabled={choice.name === current || choice.checkedOutElsewhere}
              >
                {choice.name}
                {choice.checkedOutElsewhere
                  ? ' · another worktree'
                  : choice.name === current
                    ? ' · current'
                    : ''}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )
      ) : (
        <>
          <Input
            aria-label="Branch name"
            autoFocus
            value={branch}
            disabled={busy}
            placeholder="fix/empty-review-state"
            onChange={(event) => setBranch(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={switchTo}
              disabled={busy}
              onChange={(event) => setSwitchTo(event.target.checked)}
            />
            Switch to it
          </label>
        </>
      )}
      {error && <GitActionError text={error} />}
      {git.operation?.receipt?.progress.map((line) => (
        <p key={line} role="status" className="text-xs text-muted-foreground">
          {line}
        </p>
      ))}
      {uncertain && !git.operation?.receipt && (
        <p role="status" className="text-sm text-muted-foreground">
          The response was lost. Check the existing request before starting
          another branch action.
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={() => form.close()}>
          Cancel
        </Button>
        {uncertain ? (
          <Button disabled={busy} onClick={() => checkOutcome()}>
            {busy ? 'Checking…' : 'Check outcome'}
          </Button>
        ) : (
          <Button
            disabled={busy || !branch.trim() || !aligned}
            onClick={() => submit()}
          >
            {mode === 'switch' ? <GitBranchIcon /> : <GitBranchPlusIcon />}
            {busy
              ? 'Working…'
              : mode === 'switch'
                ? 'Switch branch'
                : 'Create branch'}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
