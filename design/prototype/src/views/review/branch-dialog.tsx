import { Checkbox } from '@base-ui/react/checkbox';
import { formatDistanceToNowStrict } from 'date-fns';
import { Check, GitBranch, GitBranchPlus, TriangleAlert } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { expectationFor, receiptFailed } from '../../domain/git-action';
import { shortOid } from '../../domain/history';
import { worktreeLabel } from '../../domain/inventory';
import { changedFiles, type ReviewScope } from '../../domain/review';
import { useBranches, useGitActions } from '../../query/git-actions';
import { reviewErrorMessage, useChanges } from '../../query/review';
import { DialogIcon } from '../workspace/dialog-icon';
import { notifySuccess } from '../workspace/notify';
import { leftToBanner, plural, receiptWords } from './git-feedback';

type Mode = 'switch' | 'create';

const comeAlong = (count: number) =>
  `${plural(count, 'uncommitted file')} ${count === 1 ? 'comes' : 'come'} along`;

/**
 * Switch branch and Create branch, from the Git menu. Git is the judge: a branch
 * another worktree has checked out is disabled in the list, and whatever Git
 * refuses (that branch after all, an invalid or taken name) is shown in its own words.
 */
export function BranchDialog({
  scope,
  open,
  mode,
  onOpenChange,
}: {
  scope: ReviewScope;
  open: boolean;
  mode: Mode;
  onOpenChange: (open: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={!busy} className="gap-4 sm:max-w-md">
        {/* The popup unmounts when closed, so every open starts from the current branches. */}
        {mode === 'switch' ? (
          <SwitchBranch
            scope={scope}
            onBusy={setBusy}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <CreateBranch
            scope={scope}
            onBusy={setBusy}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type FormProps = {
  scope: ReviewScope;
  onBusy: (busy: boolean) => void;
  onClose: () => void;
};

function SwitchBranch({ scope, onBusy, onClose }: FormProps) {
  const status = useChanges(scope);
  const git = useGitActions(scope);
  const { branches, isPending, error, refetch } = useBranches(scope, true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<{
    branch: string;
    message: string;
  } | null>(null);

  const current = branches?.current ?? worktreeLabel(status.branch.name);
  const list = [...(branches?.branches ?? [])].sort((a, b) => {
    if (a.name === current) return -1;
    if (b.name === current) return 1;
    return (
      Number(a.checkedOutElsewhere) - Number(b.checkedOutElsewhere) ||
      b.lastCommitAt.localeCompare(a.lastCommitAt)
    );
  });

  const switchTo = (branch: string) => {
    if (switching != null || branch === current) return;
    setSwitching(branch);
    setRefusal(null);
    onBusy(true);
    git
      .run({ action: 'switch-branch', branch }, expectationFor(status))
      .then(
        (receipt) => {
          if (receiptFailed(receipt) && !leftToBanner(receipt)) {
            setRefusal({ branch, message: receiptWords(receipt) });
            // The list may be stale (another worktree took that branch): read it again so the row says so.
            void refetch();
            return;
          }
          onBusy(false);
          onClose();
          if (receipt.state !== 'succeeded') return;
          notifySuccess(
            `Switched to ${branch}`,
            status.changes.length > 0
              ? `${plural(changedFiles(status.changes).length, 'uncommitted file')} came along.`
              : undefined,
          );
        },
        (failure: unknown) =>
          setRefusal({ branch, message: reviewErrorMessage(failure) }),
      )
      .finally(() => {
        setSwitching(null);
        onBusy(false);
      });
  };

  return (
    <>
      <DialogHeader className="flex-row items-center gap-3 text-left">
        <DialogIcon icon={GitBranch} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle>Switch branch</DialogTitle>
          <DialogDescription>
            {status.changes.length > 0
              ? `${comeAlong(changedFiles(status.changes).length)}, unless Git says ${changedFiles(status.changes).length === 1 ? 'it' : 'they'} would be overwritten.`
              : 'The review and History follow the branch you pick.'}
          </DialogDescription>
        </div>
      </DialogHeader>

      <Command className="rounded-xl border bg-transparent p-0" loop>
        <CommandInput placeholder="Search branches…" autoFocus />
        <CommandList className="max-h-72">
          {isPending ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Spinner /> Listing branches…
            </div>
          ) : error != null ? (
            <p className="px-3 py-4 text-sm text-destructive">
              {reviewErrorMessage(error)}
            </p>
          ) : (
            <>
              <CommandEmpty>No branch matches.</CommandEmpty>
              <CommandGroup>
                {list.map((branch) => {
                  const isCurrent = branch.name === current;
                  const blocked = !isCurrent && branch.checkedOutElsewhere;
                  return (
                    <CommandItem
                      key={branch.name}
                      value={branch.name}
                      disabled={isCurrent || blocked || switching != null}
                      onSelect={() => switchTo(branch.name)}
                      // Only the name dims: the reason underneath has to stay readable. The
                      // item's own trailing check is hidden: the Current badge says it.
                      className="items-start data-[disabled=true]:opacity-100 [&>svg:last-child]:hidden"
                    >
                      {switching === branch.name ? (
                        <Spinner className="mt-0.5 size-4" />
                      ) : (
                        <GitBranch
                          className={cn(
                            'mt-0.5 text-muted-foreground',
                            blocked && 'opacity-50',
                          )}
                        />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span
                          className={cn(
                            'truncate',
                            isCurrent && 'font-medium',
                            blocked && 'opacity-50',
                          )}
                        >
                          {branch.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {blocked
                            ? 'Checked out in another worktree'
                            : isCurrent
                              ? (branch.upstream ?? 'No upstream')
                              : [
                                  branch.upstream ?? 'No upstream',
                                  formatDistanceToNowStrict(
                                    new Date(branch.lastCommitAt),
                                    { addSuffix: true },
                                  ),
                                ].join(' · ')}
                        </span>
                      </span>
                      {isCurrent && (
                        <Badge variant="secondary" className="mt-0.5">
                          <Check />
                          Current
                        </Badge>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>

      {refusal != null && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">
              Git did not switch to {refusal.branch}
            </span>
            <span className="font-mono text-[11.5px] break-words">
              {refusal.message}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function CreateBranch({ scope, onBusy, onClose }: FormProps) {
  const status = useChanges(scope);
  const git = useGitActions(scope);
  const [name, setName] = useState('');
  const [switchTo, setSwitchTo] = useState(true);
  const switchToId = useId();
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const from = worktreeLabel(status.branch.name);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const branch = name.trim();
    if (branch === '' || pending) return;
    setPending(true);
    setRefusal(null);
    onBusy(true);
    git
      .run(
        { action: 'create-branch', branch, switchTo },
        expectationFor(status),
      )
      .then(
        (receipt) => {
          if (receiptFailed(receipt) && !leftToBanner(receipt)) {
            setRefusal(receiptWords(receipt));
            return;
          }
          onBusy(false);
          onClose();
          if (receipt.state !== 'succeeded') return;
          notifySuccess(
            `Created ${branch}`,
            switchTo
              ? `You are on it now, starting from ${from}.`
              : `You are still on ${from}.`,
          );
        },
        (failure: unknown) => setRefusal(reviewErrorMessage(failure)),
      )
      .finally(() => {
        setPending(false);
        onBusy(false);
      });
  };

  return (
    <form onSubmit={submit} className="contents">
      <DialogHeader className="flex-row items-center gap-3 text-left">
        <DialogIcon icon={GitBranchPlus} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle>Create branch</DialogTitle>
          <DialogDescription>
            Starts from {from}
            {status.headOid == null ? '' : ` at ${shortOid(status.headOid)}`}.
          </DialogDescription>
        </div>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="branch-name" className="text-[12.5px] font-medium">
          Branch name
        </label>
        <Input
          id="branch-name"
          value={name}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. fix/empty-review-state"
          aria-invalid={refusal != null}
          aria-describedby={refusal == null ? undefined : 'branch-refusal'}
          disabled={pending}
          onChange={(event) => {
            setName(event.target.value);
            setRefusal(null);
          }}
          className="font-mono"
        />
        {refusal != null && (
          <p
            id="branch-refusal"
            role="alert"
            className="font-mono text-[11.5px] break-words text-destructive"
          >
            {refusal}
          </p>
        )}
      </div>

      <label
        htmlFor={switchToId}
        className="flex items-center gap-2 text-[12.5px]"
      >
        <Checkbox.Root
          id={switchToId}
          checked={switchTo}
          disabled={pending}
          onCheckedChange={setSwitchTo}
          className="grid size-4 shrink-0 place-items-center rounded-[5px] border border-input outline-none focus-visible:ring-3 focus-visible:ring-ring/30 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground"
        >
          <Checkbox.Indicator>
            <Check className="size-3" />
          </Checkbox.Indicator>
        </Checkbox.Root>
        Switch to it
        {switchTo && status.changes.length > 0 && (
          <span className="text-muted-foreground">
            · {comeAlong(changedFiles(status.changes).length)}
          </span>
        )}
      </label>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending || name.trim() === ''}>
          {pending ? <Spinner /> : <GitBranchPlus />}
          Create branch
        </Button>
      </DialogFooter>
    </form>
  );
}
