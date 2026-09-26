import { GitBranchIcon, GitBranchPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
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
import type { ReviewScope } from '@/features/review/model/review';
import {
  useBranches,
  useGitAction,
} from '@/features/review/queries/git-actions';
import {
  expectationFor,
  gitErrorMessage,
  receiptFailed,
  receiptWords,
} from './git-action-feedback';
import { GitActionError } from './git-action-message';
import type { GitActionStatus } from './git-action-options';

export function BranchDialog({
  scope,
  open,
  mode,
  status,
  onOpenChange,
}: {
  scope: ReviewScope;
  open: boolean;
  mode: 'switch' | 'create';
  status: GitActionStatus;
  onOpenChange: (open: boolean) => void;
}) {
  const action = mode === 'switch' ? 'switch-branch' : 'create-branch';
  const git = useGitAction(scope, action);
  const branches = useBranches(scope);
  const current = branches.data?.current ?? null;
  const lookedBranch =
    status.branch?.name?.replace(/^refs\/heads\//, '') ?? null;
  const aligned = branches.data !== undefined && current === lookedBranch;
  const [branch, setBranch] = useState('');
  const [switchTo, setSwitchTo] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choices = branches.data?.branches ?? [];
  const uncertain = Boolean(git.operation && !git.canStartNew);

  async function checkOutcome() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const receipt = await git.recover.submit();
      if (receiptFailed(receipt)) setError(receiptWords(receipt));
      else onOpenChange(false);
    } catch (cause) {
      setError(gitErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    const name = branch.trim();
    if (!name || busy || uncertain || !aligned) return;
    setBusy(true);
    setError(null);
    try {
      const receipt = await git.run(
        mode === 'switch'
          ? { action: 'switch-branch', branch: name }
          : { action: 'create-branch', branch: name, switchTo },
        expectationFor(status),
      );
      if (receiptFailed(receipt)) {
        setError(receiptWords(receipt));
        if (mode === 'switch') void branches.refetch();
        return;
      }
      onOpenChange(false);
    } catch (cause) {
      setError(gitErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
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
              : `Starts from ${current ?? 'the detached HEAD'}.`}
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
                  disabled={
                    choice.name === current || choice.checkedOutElsewhere
                  }
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
            {!aligned && (
              <p role="status" className="text-sm text-muted-foreground">
                Updating branch status…
              </p>
            )}
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
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {uncertain ? (
            <Button disabled={busy} onClick={() => void checkOutcome()}>
              {busy ? 'Checking…' : 'Check outcome'}
            </Button>
          ) : (
            <Button
              disabled={busy || !branch.trim() || !aligned}
              onClick={() => void submit()}
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
    </Dialog>
  );
}
