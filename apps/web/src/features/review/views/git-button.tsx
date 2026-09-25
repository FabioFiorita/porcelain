import {
  ChevronDownIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  Undo2Icon,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import type {
  ActionInput,
  GitAction,
} from '@/features/review/model/git-action';
import {
  comparisons,
  type ReviewScope,
  type Status,
} from '@/features/review/model/review';
import { useGitAction } from '@/features/review/queries/git-actions';
import { isTerminal } from '@/shared/query/operation-store';
import {
  useGitStatus,
  useRefreshGitLook,
  useReviewOverview,
} from '@/features/review/queries/review';
import { usePreferences } from '@/shared/workspace/preferences';
import { BranchDialog } from './branch-dialog';
import {
  expectationFor,
  gitErrorMessage,
  receiptFailed,
  receiptWords,
} from './git-action-feedback';
import { GitActionInspection } from './git-action-inspection';
import { GitActionMessage } from './git-action-message';
import {
  branchStatus,
  type GitActionStatus,
  gitActionBlocker,
  gitActionGroups,
  gitActionReason,
  gitActions,
  primaryGitAction,
} from './git-action-options';

type NetworkAction = 'fetch' | 'pull' | 'push';

function networkInput(
  action: NetworkAction,
  branch: Status['branch'],
  strategy: 'merge' | 'rebase',
): ActionInput {
  if (!branch?.name)
    throw new Error('Check out a branch before using the remote.');
  const name = branch.name.replace(/^refs\/heads\//, '');
  if (action === 'fetch' || action === 'pull') {
    if (!branch?.upstream || !branch.remoteName || !branch.sourceRef)
      throw new Error('Configure an upstream branch first.');
    const upstream = `${branch.remoteName}/${branch.sourceRef.replace(/^refs\/heads\//, '')}`;
    if (upstream !== branch.upstream)
      throw new Error(
        'The configured upstream changed. Review it and try again.',
      );
    if (action === 'fetch')
      return {
        action,
        remoteName: branch.remoteName,
        sourceRef: branch.sourceRef,
      };
    return {
      action,
      remoteName: branch.remoteName,
      sourceRef: branch.sourceRef,
      strategy,
    };
  }
  const ref = branch.sourceRef ?? `refs/heads/${name}`;
  const remoteName = branch.remoteName ?? 'origin';
  return {
    action,
    remoteName,
    destinationRef: ref,
    allowCreate: branch?.upstream == null,
  };
}

const iconFor = (action: GitAction) =>
  gitActions.find((candidate) => candidate.id === action)?.icon ??
  GitCommitHorizontalIcon;

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const networkLabel = (action: NetworkAction) =>
  action === 'fetch' ? 'Fetching' : action === 'pull' ? 'Pulling' : 'Pushing';

export function GitButton({ scope }: { scope: ReviewScope }) {
  const overview = useReviewOverview(scope);
  const [detailsEnabled, setDetailsEnabled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const details = useGitStatus(scope, detailsEnabled);
  const refreshLook = useRefreshGitLook(scope);
  const { preferences } = usePreferences();
  const fetchAction = useGitAction(scope, 'fetch');
  const pullAction = useGitAction(scope, 'pull');
  const pushAction = useGitAction(scope, 'push');
  const restoreDiscardedAction = useGitAction(scope, 'stash-apply');
  const [busy, setBusy] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [action, setAction] = useState<GitAction | null>(null);
  const [openedStatus, setOpenedStatus] = useState<GitActionStatus | null>(
    null,
  );
  if (overview == null) return null;
  const status = {
    statusToken: overview.changes.statusToken,
    inProgress: overview.changes.inProgress,
    mergeHeadOid: overview.changes.mergeHeadOid,
    headOid: overview.changes.headOid,
    branch: details.status?.branch ?? overview.changes.branch,
    changes: comparisons(overview.changes),
    files: overview.changes.changes.map(({ path, fingerprint }) => ({
      path,
      fingerprint,
    })),
  };
  const selected = gitActions.find((candidate) => candidate.id === action);
  const primary = primaryGitAction(status);
  const PrimaryIcon =
    primary.kind === 'run' ? iconFor(primary.action) : GitCommitHorizontalIcon;
  const primaryTip = primaryTooltip(primary, status);
  const branch = branchStatus(status);
  const runners = { fetch: fetchAction, pull: pullAction, push: pushAction };
  const runningOperations: {
    name: NetworkAction;
    operation: typeof fetchAction.operation;
  }[] = [
    { name: 'fetch', operation: fetchAction.operation },
    { name: 'pull', operation: pullAction.operation },
    { name: 'push', operation: pushAction.operation },
  ];
  const running = runningOperations.find(
    ({ operation }) =>
      operation != null &&
      (!operation.receipt || !isTerminal(operation.receipt)),
  );

  const runNetwork = async (next: NetworkAction) => {
    const runner = runners[next];
    const label =
      next === 'fetch' ? 'Fetch' : next === 'pull' ? 'Pull' : 'Push';
    const displayedBranch = status.branch;
    let looked = details.status;
    if (!looked) {
      setDetailsEnabled(true);
      looked = await details.read();
      if (
        looked &&
        (looked.branch?.name !== displayedBranch?.name ||
          looked.branch?.upstream !== displayedBranch?.upstream)
      ) {
        toast.add({
          title: `${label} did not run`,
          description: 'The branch target changed. Review it and try again.',
          type: 'error',
        });
        return;
      }
    }
    if (!looked) {
      toast.add({
        title: `${label} did not run`,
        description: 'The branch target is still loading. Try again.',
        type: 'error',
      });
      return;
    }
    let input: ActionInput;
    try {
      input = networkInput(next, looked.branch, preferences.pullStrategy);
    } catch (error) {
      toast.add({
        title: `${label} did not run`,
        description: <GitActionMessage text={gitErrorMessage(error)} />,
        type: 'error',
      });
      return;
    }
    setProgressOpen(true);
    void runner
      .run(
        input,
        expectationFor(looked, [], looked.branch?.upstreamOid ?? null),
      )
      .then((receipt) => {
        setProgressOpen(false);
        toast.add({
          title: receiptFailed(receipt) ? `${label} did not run` : label,
          description: <GitActionMessage text={receiptWords(receipt)} />,
          type: receiptFailed(receipt) ? 'error' : 'success',
        });
      })
      .catch((error: unknown) => {
        setProgressOpen(false);
        toast.add({
          title: `${label} did not run`,
          description: <GitActionMessage text={gitErrorMessage(error)} />,
          type: 'error',
        });
      });
  };

  const restoreDiscarded = async (item: {
    oid: string;
    path: string;
    kind: 'hunk' | 'rename';
  }) => {
    setMenuOpen(false);
    let looked = details.status;
    if (!looked) {
      setDetailsEnabled(true);
      looked = await details.read();
    }
    if (!looked) {
      toast.add({
        title: 'Could not restore the discarded change',
        description: 'The worktree status is still loading. Try again.',
        type: 'error',
      });
      return;
    }
    const label =
      item.kind === 'rename'
        ? `rename of ${item.path}`
        : `hunk of ${item.path}`;
    try {
      const receipt = await restoreDiscardedAction.run(
        {
          action: 'stash-apply',
          stashOid: item.oid,
          restoreIndex: item.kind === 'rename',
        },
        expectationFor(looked, [item.path], undefined, true),
      );
      toast.add({
        title: receiptFailed(receipt)
          ? `Could not restore the discarded ${label}`
          : `Restored the discarded ${label}`,
        description: receiptFailed(receipt) ? (
          <GitActionMessage text={receiptWords(receipt)} />
        ) : undefined,
        type: receiptFailed(receipt) ? 'error' : 'success',
      });
    } catch (error) {
      toast.add({
        title: `Could not restore the discarded ${label}`,
        description: <GitActionMessage text={gitErrorMessage(error)} />,
        type: 'error',
      });
    }
  };

  const choose = (next: GitAction) => {
    if (next === 'fetch' || next === 'pull' || next === 'push') {
      void runNetwork(next);
      return;
    }
    setOpenedStatus(status);
    setAction(next);
  };

  return (
    <>
      <fieldset
        aria-label="Git controls"
        className="m-0 flex shrink-0 border-0 p-0"
      >
        <Popover
          open={running != null && progressOpen}
          onOpenChange={(open) => {
            if (running) setProgressOpen(open);
          }}
        >
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={
                  running
                    ? `${networkLabel(running.name)} in progress: show progress`
                    : primary.label
                }
                title={
                  running
                    ? `${networkLabel(running.name)} in progress`
                    : primaryTip
                }
                disabled={running == null && primary.kind === 'hint'}
                focusableWhenDisabled
                className="aria-disabled:cursor-default"
                onClick={() => {
                  if (running) return;
                  if (primary.kind === 'commit') choose('commit');
                  else if (primary.kind === 'run')
                    void runNetwork(primary.action);
                }}
              />
            }
          >
            {running ? (
              <Spinner className="size-3.5" />
            ) : (
              <PrimaryIcon className="size-3.5" />
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <PopoverTitle className="flex items-center">
              <Spinner className="size-3.5" />
              {running ? `${networkLabel(running.name)}…` : 'Git action…'}
            </PopoverTitle>
            <ol className="flex flex-col gap-0.5 font-mono text-[11px] leading-4">
              {running?.operation?.receipt?.progress.length ? (
                running.operation.receipt.progress.slice(-4).map((line) => (
                  <li key={line} className="truncate" title={line}>
                    {line}
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">Waiting for Git…</li>
              )}
            </ol>
          </PopoverContent>
        </Popover>
        <DropdownMenu
          open={menuOpen}
          onOpenChange={(open) => {
            setMenuOpen(open);
            if (open) setDetailsEnabled(true);
          }}
        >
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Git actions"
                title="Git actions menu"
                disabled={running != null}
              />
            }
          >
            <ChevronDownIcon className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center">
                <GitBranchIcon className="size-3.5 shrink-0" />
                <span className="truncate">
                  {branch
                    ? (branch.name?.replace(/^refs\/heads\//, '') ??
                      'Detached HEAD')
                    : 'Git actions'}
                </span>
                {branch && (
                  <span className="ml-auto shrink-0 tabular-nums">
                    {branch.ahead} ahead · {branch.behind} behind
                  </span>
                )}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {gitActionGroups.map((group, index) => (
              <Fragment key={group.id}>
                <DropdownMenuGroup>
                  {group.actions.map((candidate) => {
                    const network =
                      candidate.id === 'fetch' ||
                      candidate.id === 'pull' ||
                      candidate.id === 'push';
                    const blocker =
                      network && details.pending
                        ? 'Reading the configured upstream.'
                        : gitActionBlocker(candidate.id, status);
                    const reason =
                      blocker ?? gitActionReason(candidate.id, status);
                    const Icon = iconFor(candidate.id);
                    return (
                      <DropdownMenuItem
                        key={candidate.id}
                        disabled={blocker != null}
                        onClick={() => choose(candidate.id)}
                        className="items-start"
                      >
                        <Icon
                          className={
                            blocker != null ? 'mt-0.5 opacity-50' : 'mt-0.5'
                          }
                        />
                        <span className="flex min-w-0 flex-col">
                          <span
                            className={
                              blocker != null ? 'opacity-50' : undefined
                            }
                          >
                            {candidate.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {candidate.description}
                          </span>
                          {reason && (
                            <span className="text-xs text-muted-foreground">
                              {reason}
                            </span>
                          )}
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
                {index < gitActionGroups.length - 1 && (
                  <DropdownMenuSeparator />
                )}
              </Fragment>
            ))}
            {(branch?.discarded?.length ?? 0) > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Discarded</DropdownMenuLabel>
                  {branch?.discarded?.map((item) => {
                    const label =
                      item.kind === 'rename'
                        ? `Restore discarded rename of ${item.path}`
                        : `Restore discarded hunk of ${item.path}`;
                    return (
                      <DropdownMenuItem
                        key={item.oid}
                        onClick={() => void restoreDiscarded(item)}
                      >
                        <Undo2Icon />
                        <span className="flex min-w-0 flex-col">
                          <span>{label}</span>
                          <span className="text-xs text-muted-foreground">
                            Kept until you restore it
                          </span>
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </fieldset>

      {action === 'switch-branch' || action === 'create-branch' ? (
        <BranchDialog
          scope={scope}
          open
          mode={action === 'switch-branch' ? 'switch' : 'create'}
          status={openedStatus ?? status}
          onOpenChange={(open) => {
            if (!open) setAction(null);
          }}
        />
      ) : action != null ? (
        <Dialog
          open
          disablePointerDismissal
          onOpenChange={(open) => {
            if (!open && !busy) setAction(null);
          }}
        >
          <DialogContent
            aria-busy={busy}
            className="max-h-[min(90svh,48rem)] overflow-y-auto sm:max-w-2xl"
          >
            {selected?.id !== 'commit' && selected?.id !== 'amend' && (
              <DialogHeader>
                <DialogTitle>{selected?.label ?? 'Git action'}</DialogTitle>
                <DialogDescription>
                  {selected?.id === 'stash-pop'
                    ? 'Its changes come back into the working tree and the stash is dropped.'
                    : 'Every change, new files included, is set aside until you pop the stash.'}
                </DialogDescription>
              </DialogHeader>
            )}
            <GitActionInspection
              scope={scope}
              entry={action}
              status={openedStatus ?? status}
              onBusy={setBusy}
              onLookAgain={async () => {
                const changes = await refreshLook();
                setOpenedStatus({
                  statusToken: changes.statusToken,
                  headOid: changes.headOid,
                  branch: changes.branch,
                  inProgress: changes.inProgress,
                  mergeHeadOid: changes.mergeHeadOid,
                  changes: comparisons(changes),
                  files: changes.changes.map(({ path, fingerprint }) => ({
                    path,
                    fingerprint,
                  })),
                });
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

function primaryTooltip(
  primary: ReturnType<typeof primaryGitAction>,
  status: Parameters<typeof primaryGitAction>[0],
) {
  if (primary.kind === 'hint') return primary.hint;
  if (primary.kind === 'commit')
    return `Commit ${plural(status.changes.length, 'changed file')}`;
  const branch = branchStatus(status);
  const upstream = branch?.upstream ?? 'the configured remote';
  if (primary.action === 'pull') return `Pull from ${upstream}`;
  return `Push ${plural(branch?.ahead ?? 0, 'commit')} to ${upstream}`;
}
