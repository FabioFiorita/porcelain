import { ChevronDownIcon, GitBranchIcon, Undo2Icon } from 'lucide-react';
import { Fragment, useState } from 'react';
import {
  useGitStatus,
  useRefreshGitLook,
  useReviewOverview,
} from '@/features/changes/index';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
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
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { usePreferences } from '@/features/preferences/index';
import { useGitMenu } from '../commands/git-menu';
import type { GitNotice } from '@porcelain/client/git-actions/rules';
import type { GitAction, GitScope } from '@porcelain/client/git-actions/rules';
import {
  gitActionGroups,
  gitActions,
} from '@porcelain/client/git-actions/rules';
import {
  isNetworkAction,
  networkLabel,
  primaryTooltip,
} from '@porcelain/client/git-actions/rules';
import {
  branchStatus,
  type GitActionStatus,
  gitActionBlocker,
  gitActionReason,
  primaryGitAction,
  shownBranch,
  statusFromChanges,
  suggestedCount,
} from '@porcelain/client/git-actions/rules';
import { GitActionIcon } from './git-action-icon';
import { GitActionInspection } from './git-action-inspection';
import { GitActionError, GitActionMessage } from './git-action-message';

export function GitButton({
  scope,
  context,
}: {
  scope: GitScope;
  context: Parameters<typeof useGitMenu>[1];
}) {
  const { connection } = context;
  const overview = useReviewOverview(scope, connection);
  const [detailsEnabled, setDetailsEnabled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const settled =
    overview != null &&
    primaryGitAction(statusFromChanges(overview.changes)).kind === 'hint';
  const detailsLive = detailsEnabled || settled;
  const details = useGitStatus(scope, connection, detailsLive);
  const refreshLook = useRefreshGitLook(scope, connection);
  const { preferences } = usePreferences();
  const [busy, setBusy] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [result, setResult] = useState<GitNotice | null>(null);
  const [action, setAction] = useState<GitAction | null>(null);
  const [openedStatus, setOpenedStatus] = useState<GitActionStatus | null>(
    null,
  );
  const menu = useGitMenu(scope, context, {
    details,
    enableDetails: () => setDetailsEnabled(true),
    pullStrategy: preferences.pullStrategy,
    notify: ({ title, description, type }) =>
      toast.add({
        title,
        description:
          description === undefined ? undefined : (
            <GitActionMessage text={description} />
          ),
        type,
      }),
    onProgress: (open) => {
      if (open) setResult(null);
      setProgressOpen(open);
    },
    onResult: setResult,
    refreshLook,
    onLooked: setOpenedStatus,
  });
  if (overview == null) return null;
  const status = {
    ...statusFromChanges(overview.changes),
    branch: shownBranch(
      overview.changes.branch,
      detailsLive ? details.status?.branch : undefined,
    ),
  };
  const selected = gitActions.find((candidate) => candidate.id === action);
  const primary = primaryGitAction(status);
  const primaryTip = primaryTooltip(primary, status);
  const suggested = primary.kind === 'run' || primary.kind === 'stash';
  const count = suggestedCount(primary, status);
  const branch = branchStatus(status);
  const running = menu.running;

  const choose = (next: GitAction) => {
    if (isNetworkAction(next)) {
      menu.runNetwork(next, status.branch);
      return;
    }
    setOpenedStatus(status);
    setAction(next);
  };

  return (
    <>
      <ButtonGroup aria-label="Git controls" className="shrink-0">
        <Popover
          open={(running != null && progressOpen) || result != null}
          onOpenChange={(open) => {
            if (!open) setResult(null);
            if (running) setProgressOpen(open);
          }}
        >
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size={suggested && !running ? 'sm' : 'icon-sm'}
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
                  if (running || result) return;
                  if (primary.kind === 'commit') choose('commit');
                  else if (primary.kind === 'stash') choose('stash-apply');
                  else if (primary.kind === 'run')
                    menu.runNetwork(primary.action, status.branch);
                }}
              />
            }
          >
            {running ? (
              <Spinner className="size-3.5" />
            ) : (
              <GitActionIcon
                action={
                  primary.kind === 'run'
                    ? primary.action
                    : primary.kind === 'stash'
                      ? 'stash-apply'
                      : 'commit'
                }
                className="size-3.5"
              />
            )}
            {suggested && !running && (
              <span aria-hidden="true">
                {primary.label}
                {count != null && ` ${count}`}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            {result && !running ? (
              <PopoverHeader>
                <PopoverTitle>{result.title}</PopoverTitle>
                {result.description !== undefined &&
                  (result.type === 'error' ? (
                    <GitActionError text={result.description} />
                  ) : (
                    <PopoverDescription>
                      <GitActionMessage text={result.description} />
                    </PopoverDescription>
                  ))}
              </PopoverHeader>
            ) : (
              <>
                <PopoverTitle>
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
              </>
            )}
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
                    const blocker =
                      isNetworkAction(candidate.id) && details.pending
                        ? 'Reading the configured upstream.'
                        : gitActionBlocker(candidate.id, status);
                    const reason =
                      blocker ?? gitActionReason(candidate.id, status);
                    return (
                      <DropdownMenuItem
                        key={candidate.id}
                        disabled={blocker != null}
                        onClick={() => choose(candidate.id)}
                        className="items-start"
                      >
                        <GitActionIcon
                          action={candidate.id}
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
                        onClick={() => {
                          setMenuOpen(false);
                          menu.restoreDiscarded(item);
                        }}
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
      </ButtonGroup>

      {action != null ? (
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
                    : selected?.id === 'stash-apply'
                      ? 'Its changes come back into the working tree and the stash is kept.'
                      : 'Every change, new files included, is set aside until you pop the stash.'}
                </DialogDescription>
              </DialogHeader>
            )}
            <GitActionInspection
              scope={scope}
              context={context}
              entry={action}
              status={openedStatus ?? status}
              onBusy={setBusy}
              onLookAgain={menu.lookAgain}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
