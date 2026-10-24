import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
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
import { BranchTracking } from '@/features/history/index';
import { branchTracking } from '@porcelain/client/history/rules';
import { GitActionError, GitActionMessage } from './git-action-message';

export function GitButton({
  scope,
  context,
}: {
  scope: GitScope;
  context: Parameters<typeof useGitMenu>[1];
}) {
  const { connection } = context;
  const overview = Option.getOrUndefined(
    AsyncResult.value(useReviewOverview(scope, connection)),
  );
  const [detailsEnabled, setDetailsEnabled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const settled =
    overview !== null &&
    overview !== undefined &&
    primaryGitAction(statusFromChanges(overview)).kind === 'hint';
  const detailsLive = detailsEnabled || settled;
  const details = useGitStatus(scope, connection, detailsLive);
  const detailedStatus = Option.getOrUndefined(
    AsyncResult.value(details.result),
  );
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
  if (overview === null || overview === undefined) return null;
  const status = {
    ...statusFromChanges(overview),
    branch: shownBranch(
      overview.branch,
      detailsLive ? detailedStatus?.branch : undefined,
    ),
  };
  const selected = gitActions.find((candidate) => candidate.id === action);
  const primary = primaryGitAction(status);
  const primaryTip = primaryTooltip(primary, status);
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
        <Tooltip>
          <Popover
            open={
              (running !== null && running !== undefined && progressOpen) ||
              (result !== null && result !== undefined)
            }
            onOpenChange={(open) => {
              if (!open) setResult(null);
              if (running) setProgressOpen(open);
            }}
          >
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={
                        running
                          ? `${networkLabel(running.name)} in progress: show progress`
                          : primary.label
                      }
                      disabled={
                        (running === null || running === undefined) &&
                        primary.kind === 'hint'
                      }
                      focusableWhenDisabled
                      className="aria-disabled:cursor-default"
                      onClick={() => {
                        if (running || result) return;
                        if (primary.kind === 'commit') choose('commit');
                        else if (primary.kind === 'stash')
                          choose('stash-apply');
                        else if (primary.kind === 'run')
                          menu.runNetwork(primary.action, status.branch);
                      }}
                    />
                  }
                />
              }
            >
              {running ? (
                <Spinner className="size-3.5" />
              ) : (
                <GitActionIcon
                  action={primaryIcon(primary)}
                  className="size-3.5"
                />
              )}
              <span aria-hidden="true">
                {running ? `${networkLabel(running.name)}…` : primary.label}
                {!running &&
                  count !== null &&
                  count !== undefined &&
                  ` ${count}`}
              </span>
            </TooltipTrigger>
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
                  <ol className="flex flex-col gap-0.5 font-mono text-2xs leading-4">
                    {running?.operation?.receipt?.progress.length ? (
                      running.operation.receipt.progress
                        .slice(-4)
                        .map((line) => (
                          <li key={line} className="truncate" title={line}>
                            {line}
                          </li>
                        ))
                    ) : (
                      <li className="text-muted-foreground">
                        Waiting for Git…
                      </li>
                    )}
                  </ol>
                </>
              )}
            </PopoverContent>
          </Popover>
          <TooltipContent role="tooltip" className="break-all">
            {running
              ? `${networkLabel(running.name)} in progress: show progress`
              : primaryTip}
          </TooltipContent>
        </Tooltip>
        <DropdownMenu
          open={menuOpen}
          onOpenChange={(open) => {
            setMenuOpen(open);
            if (open) setDetailsEnabled(true);
          }}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Git actions"
                      disabled={running !== null && running !== undefined}
                    />
                  }
                />
              }
            >
              <ChevronDownIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent role="tooltip" className="break-all">
              Git actions
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-76">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                {branch ? (
                  <BranchTracking
                    tracking={branchTracking(branch, null)}
                    focusable={false}
                  />
                ) : (
                  <span className="flex items-center gap-2">
                    <GitBranchIcon className="size-3.5 shrink-0" />
                    Git actions
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
                      isNetworkAction(candidate.id) &&
                      detailsLive &&
                      AsyncResult.isInitial(details.result)
                        ? 'Reading the configured upstream.'
                        : gitActionBlocker(candidate.id, status);
                    const reason =
                      blocker ?? gitActionReason(candidate.id, status);
                    return (
                      <Tooltip
                        key={candidate.id}
                        onOpenChange={(_open, details) => {
                          if (details.reason === 'escape-key')
                            details.allowPropagation();
                        }}
                      >
                        <TooltipTrigger render={<span className="block" />}>
                          <DropdownMenuItem
                            disabled={blocker !== null && blocker !== undefined}
                            onClick={() => choose(candidate.id)}
                          >
                            <GitActionIcon action={candidate.id} />
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate">
                                {candidate.label}
                              </span>
                              {blocker && (
                                <span className="text-xs whitespace-normal text-muted-foreground">
                                  {blocker}
                                </span>
                              )}
                            </span>
                          </DropdownMenuItem>
                        </TooltipTrigger>
                        <TooltipContent>
                          {candidate.description}
                          {reason && ` ${reason}`}
                        </TooltipContent>
                      </Tooltip>
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
                      <Tooltip key={item.oid}>
                        <TooltipTrigger render={<span className="block" />}>
                          <DropdownMenuItem
                            onClick={() => {
                              setMenuOpen(false);
                              menu.restoreDiscarded(item);
                            }}
                          >
                            <Undo2Icon />
                            <span className="min-w-0 truncate">{label}</span>
                          </DropdownMenuItem>
                        </TooltipTrigger>
                        <TooltipContent>
                          {label} · Kept until you restore it
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </DropdownMenuGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>

      {action !== null && action !== undefined ? (
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
                  {stashDescription(selected?.id)}
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

function primaryIcon(primary: ReturnType<typeof primaryGitAction>): GitAction {
  if (primary.kind === 'run') return primary.action;
  if (primary.kind === 'stash') return 'stash-apply';
  return 'commit';
}

function stashDescription(action: GitAction | undefined) {
  if (action === 'stash-pop')
    return 'Its changes come back into the working tree and the stash is dropped.';
  if (action === 'stash-apply')
    return 'Its changes come back into the working tree and the stash is kept.';
  return 'Every change, new files included, is set aside until you pop the stash.';
}
