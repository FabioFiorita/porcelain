import { PendingButton, PendingContent } from '@/shared/views/pending-button';
import { PendingSpinner } from '@/shared/views/state-notice';
import { useWorkspaceWriteBlock } from '@/shared/workspace/connection';
import { TruncatedText } from '@/shared/views/truncated-text';
import { AsyncResult } from 'effect/reactivity';
import { useAtomRef } from '@effect/atom-react';
import { isTerminal, operationKey } from '@porcelain/client/git-actions';
import { Option } from 'effect';
import { ChevronDownIcon, GitBranchIcon, Undo2Icon } from 'lucide-react';
import { Fragment, useState } from 'react';
import {
  useGitStatus,
  useRefreshGitLook,
  useReviewOverview,
} from '@/features/changes/index';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/shared/lib/utils';
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
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { notify } from '@/shared/views/notify';
import { useReviewGitSettings } from '@/features/preferences/index';
import {
  reviewGitPullStrategy,
  reviewGitSettingsBlock,
} from '@porcelain/client/preferences/rules';
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
  networkActionBlocker,
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
  const { operations } = useAtomRef(connection.operations.state);
  const overview = Option.getOrUndefined(
    AsyncResult.value(useReviewOverview(scope, connection)),
  );
  const [compact, setCompact] = useState(false);
  const [measureLabel] = useState(() => (element: HTMLSpanElement | null) => {
    if (!element) return;
    const measure = () => setCompact(element.getClientRects().length === 0);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  });
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
  const settings = useReviewGitSettings(connection);
  const pullStrategy = reviewGitPullStrategy(settings);
  const pullBlock = pullStrategy ? undefined : reviewGitSettingsBlock(settings);
  const [busy, setBusy] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [result, setResult] = useState<GitNotice | null>(null);
  const [action, setAction] = useState<GitAction | null>(null);
  const [openedStatus, setOpenedStatus] = useState<GitActionStatus | null>(
    null,
  );
  const writeBlock = useWorkspaceWriteBlock(context);
  const showNotice = ({ title, description, type }: GitNotice) =>
    notify({
      title,
      description:
        description === undefined ? undefined : (
          <GitActionMessage text={description} />
        ),
      type,
    });
  const menu = useGitMenu(scope, context, {
    details,
    enableDetails: () => setDetailsEnabled(true),
    pull: pullStrategy
      ? { kind: 'ready', strategy: pullStrategy }
      : {
          kind: 'blocked',
          reason:
            pullBlock ??
            'Changes & Git settings for this computer are unavailable.',
        },
    notify: showNotice,
    onProgress: (open) => {
      if (open) setResult(null);
      setProgressOpen(open);
    },
    onResult: (notice) => {
      setResult(notice.type === 'error' ? notice : null);
      if (notice.type !== 'error') showNotice(notice);
    },
    refreshLook,
    onLooked: setOpenedStatus,
  });
  if (overview === null || overview === undefined)
    return (
      <span aria-hidden="true" className="invisible flex shrink-0">
        <span
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'rounded-r-none @max-lg/pane:w-7 @max-lg/pane:px-0',
          )}
        >
          <GitActionIcon action="commit" className="size-3.5" />
          <span className="hidden @min-lg/pane:inline">Commit</span>
        </span>
        <span
          className={cn(
            buttonVariants({ variant: 'outline', size: 'icon' }),
            'rounded-l-none border-l-0',
          )}
        />
      </span>
    );
  const status = {
    ...statusFromChanges(overview),
    branch: shownBranch(
      overview.branch,
      detailsLive ? detailedStatus?.branch : undefined,
    ),
  };
  const selected = gitActions.find((candidate) => candidate.id === action);
  const primary = primaryGitAction(status);
  const primaryBlocked =
    primary.kind === 'run' && primary.action === 'pull' && !pullStrategy;
  const primaryTip =
    writeBlock ??
    (primaryBlocked && pullBlock ? pullBlock : primaryTooltip(primary, status));
  const count = suggestedCount(primary, status);
  const branch = branchStatus(status);
  const running = menu.running;
  const reading = detailsLive && AsyncResult.isInitial(details.result);
  const shownGroups = reading ? gitActionGroups.slice(0, 1) : gitActionGroups;

  const choose = (next: GitAction) => {
    if (writeBlock) return;
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
                      size={compact ? 'icon' : 'default'}
                      aria-label={
                        running
                          ? `${networkLabel(running.name)} in progress: show progress`
                          : primary.label
                      }
                      disabled={
                        (running === null || running === undefined) &&
                        (primary.kind === 'hint' ||
                          primaryBlocked ||
                          Boolean(writeBlock))
                      }
                      aria-busy={Boolean(running)}
                      aria-description={writeBlock}
                      focusableWhenDisabled
                      className="aria-disabled:cursor-default"
                      onClick={() => {
                        if (running || result || writeBlock) return;
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
              <PendingContent pending={Boolean(running)}>
                <GitActionIcon
                  action={primaryIcon(primary)}
                  className="size-3.5"
                />
              </PendingContent>
              <span
                ref={measureLabel}
                aria-hidden="true"
                className="hidden @min-lg/pane:inline"
              >
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
                  {result.description !== undefined && (
                    <GitActionError text={result.description} />
                  )}
                </PopoverHeader>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <PopoverTitle>
                    {running ? `${networkLabel(running.name)}…` : 'Git action…'}
                  </PopoverTitle>
                  <ol className="flex flex-col gap-0.5 font-mono text-2xs leading-4">
                    {running?.operation?.receipt?.progress.length ? (
                      running.operation.receipt.progress
                        .slice(-4)
                        .map((line) => (
                          <TruncatedText
                            key={line}
                            render={<li />}
                            text={line}
                          />
                        ))
                    ) : (
                      <li className="text-muted-foreground">
                        Waiting for Git…
                      </li>
                    )}
                  </ol>
                  {running && result?.description && (
                    <GitActionError text={result.description} />
                  )}
                  {running && (
                    <PendingButton
                      variant="outline"
                      className="self-start"
                      pending={running.checking}
                      onClick={menu.checkOutcome}
                    >
                      Check outcome
                    </PendingButton>
                  )}
                </div>
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
                      size="icon"
                      aria-label="Git actions"
                      disabled={
                        Boolean(writeBlock) ||
                        (running !== null && running !== undefined)
                      }
                      aria-description={writeBlock}
                    />
                  }
                />
              }
            >
              <ChevronDownIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent role="tooltip" className="break-all">
              {writeBlock ?? 'Git actions'}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-76" aria-busy={reading}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                {branch ? (
                  <BranchTracking tracking={branchTracking(branch, null)} />
                ) : (
                  <span className="flex items-center gap-2">
                    <GitBranchIcon className="size-3.5 shrink-0" />
                    Git actions
                  </span>
                )}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {shownGroups.map((group, index) => (
              <Fragment key={group.id}>
                <DropdownMenuGroup>
                  {group.actions.map((candidate) => {
                    const pending = operations.get(
                      operationKey(scope, candidate.id),
                    );
                    const recoveringStash =
                      candidate.id.startsWith('stash-') &&
                      pending &&
                      (!pending.receipt || !isTerminal(pending.receipt));
                    const blocker = recoveringStash
                      ? null
                      : networkActionBlocker(candidate.id, status, pullBlock);
                    const reason =
                      writeBlock ??
                      (blocker
                        ? undefined
                        : gitActionReason(candidate.id, status));
                    return (
                      <Tooltip key={candidate.id}>
                        <TooltipTrigger
                          render={
                            <DropdownMenuItem
                              className="data-disabled:pointer-events-auto"
                              disabled={
                                Boolean(writeBlock) ||
                                (blocker !== null && blocker !== undefined)
                              }
                              aria-description={writeBlock}
                              onSelect={() => choose(candidate.id)}
                            />
                          }
                        >
                          <GitActionIcon action={candidate.id} />
                          <span className="flex min-w-0 flex-col">
                            <TruncatedText text={candidate.label} />
                            {(recoveringStash || blocker) && (
                              <span className="text-xs whitespace-normal text-muted-foreground">
                                {recoveringStash
                                  ? 'Check the previous outcome.'
                                  : blocker}
                              </span>
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {candidate.description}
                          {reason && ` ${reason}`}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </DropdownMenuGroup>
                {(reading || index < shownGroups.length - 1) && (
                  <DropdownMenuSeparator />
                )}
              </Fragment>
            ))}
            {reading && (
              <PendingSpinner
                label="Reading Git status"
                className="mx-2 my-1"
              />
            )}
            {!reading && (branch?.discarded?.length ?? 0) > 0 && (
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
                        <TooltipTrigger
                          render={
                            <DropdownMenuItem
                              onSelect={() => {
                                setMenuOpen(false);
                                menu.restoreDiscarded(item);
                              }}
                            />
                          }
                        >
                          <Undo2Icon />
                          <TruncatedText
                            className="min-w-0"
                            text={label}
                            propagateEscape
                          />
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
          closeOnOutsidePress={false}
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
                {selected?.id !== 'stash-create' && (
                  <DialogDescription>
                    {stashDescription(selected?.id)}
                  </DialogDescription>
                )}
              </DialogHeader>
            )}
            <GitActionInspection
              scope={scope}
              context={context}
              entry={action}
              status={openedStatus ?? status}
              current={status}
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
