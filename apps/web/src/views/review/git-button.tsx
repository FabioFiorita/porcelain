import {
  ChevronDownIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  type LucideIcon,
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
import { toast } from '@/components/ui/toast';
import type { ActionInput, GitAction } from '../../domain/git-action';
import { comparisons, type ReviewScope } from '../../domain/review';
import { useGitAction } from '../../query/git-actions';
import { useRefreshGitLook, useReviewOverview } from '../../query/review';
import { usePreferences } from '../workspace/preferences';
import { BranchDialog } from './branch-dialog';
import {
  expectationFor,
  gitErrorMessage,
  receiptFailed,
  receiptWords,
} from './git-action-feedback';
import { GitActionInspection } from './git-action-inspection';
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

/** Fetch, pull and push use the branch the reviewer is already looking at. */
function networkInput(
  action: NetworkAction,
  status: GitActionStatus,
  strategy: 'merge' | 'rebase',
): ActionInput {
  const name = status.branch?.name?.replace(/^refs\/heads\//, '') ?? 'main';
  const ref = `refs/heads/${name}`;
  const remoteName = status.branch?.upstream?.split('/')[0] || 'origin';
  if (action === 'fetch') return { action, remoteName, sourceRef: ref };
  if (action === 'pull')
    return { action, remoteName, sourceRef: ref, strategy };
  return {
    action,
    remoteName,
    destinationRef: ref,
    allowCreate: status.branch?.upstream == null,
  };
}

const ICONS: Record<GitAction, LucideIcon> = Object.fromEntries(
  gitActions.map((action) => [action.id, action.icon]),
) as Record<GitAction, LucideIcon>;

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * Git actions stay attached to the document tabs. The first half is the
 * likely next action; the chevron keeps every current API action discoverable.
 */
export function GitButton({ scope }: { scope: ReviewScope }) {
  const overview = useReviewOverview(scope);
  const refreshLook = useRefreshGitLook(scope);
  const { preferences } = usePreferences();
  const fetchAction = useGitAction(scope, 'fetch');
  const pullAction = useGitAction(scope, 'pull');
  const pushAction = useGitAction(scope, 'push');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<GitAction | null>(null);
  const [openedStatus, setOpenedStatus] = useState<GitActionStatus | null>(
    null,
  );
  if (overview == null) return null;
  // What an action needs to be decided; the panel reads the rest when it opens.
  const status = {
    statusToken: overview.changes.statusToken,
    inProgress: overview.changes.inProgress,
    mergeHeadOid: overview.changes.mergeHeadOid,
    headOid: overview.changes.headOid,
    branch: overview.changes.branch,
    changes: comparisons(overview.changes),
    files: overview.changes.changes.map(({ path, fingerprint }) => ({
      path,
      fingerprint,
    })),
  };
  const selected = gitActions.find((candidate) => candidate.id === action);
  const primary = primaryGitAction(status);
  const PrimaryIcon =
    primary.kind === 'run' ? ICONS[primary.action] : GitCommitHorizontalIcon;
  const primaryTip = primaryTooltip(primary, status);
  const branch = branchStatus(status);

  const runNetwork = (next: NetworkAction) => {
    const runner =
      next === 'fetch'
        ? fetchAction
        : next === 'pull'
          ? pullAction
          : pushAction;
    const label =
      next === 'fetch' ? 'Fetch' : next === 'pull' ? 'Pull' : 'Push';
    void runner
      .run(
        networkInput(next, status, preferences.pullStrategy),
        expectationFor(status),
      )
      .then((receipt) => {
        toast.add({
          title: receiptFailed(receipt) ? `${label} did not run` : label,
          description: receiptWords(receipt),
          type: receiptFailed(receipt) ? 'error' : 'success',
        });
      })
      .catch((error: unknown) => {
        toast.add({
          title: `${label} did not run`,
          description: gitErrorMessage(error),
          type: 'error',
        });
      });
  };

  const choose = (next: GitAction) => {
    if (next === 'fetch' || next === 'pull' || next === 'push') {
      runNetwork(next);
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
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={primary.label}
          title={primaryTip}
          disabled={primary.kind === 'hint'}
          focusableWhenDisabled
          className="rounded-e-none border-e-0 aria-disabled:cursor-default aria-disabled:opacity-60 aria-disabled:hover:bg-background dark:aria-disabled:hover:bg-transparent"
          onClick={() => {
            if (primary.kind === 'commit') choose('commit');
            else if (primary.kind === 'run') runNetwork(primary.action);
          }}
        >
          <PrimaryIcon className="size-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Git actions"
                title="Git actions menu"
                className="rounded-s-none"
              />
            }
          >
            <ChevronDownIcon className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-1.5">
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
                    const blocker = gitActionBlocker(candidate.id, status);
                    const reason =
                      blocker ?? gitActionReason(candidate.id, status);
                    const Icon = ICONS[candidate.id];
                    return (
                      <DropdownMenuItem
                        key={candidate.id}
                        disabled={blocker != null}
                        onClick={() => choose(candidate.id)}
                        className="items-start data-disabled:opacity-100"
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
            <DialogHeader>
              <DialogTitle>
                {selected?.id === 'commit'
                  ? 'Commit changes'
                  : selected?.id === 'amend'
                    ? 'Amend last commit'
                    : (selected?.label ?? 'Git action')}
              </DialogTitle>
              <DialogDescription>
                {selected?.id === 'commit' || selected?.id === 'amend'
                  ? 'Committed steps fold away in the review and show up in History.'
                  : selected?.id === 'stash-pop'
                    ? 'Its changes come back into the working tree and the stash is dropped.'
                    : 'Every change, new files included, is set aside until you pop the stash.'}
              </DialogDescription>
            </DialogHeader>
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
