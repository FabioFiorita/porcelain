import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GitBranch,
  GitBranchPlus,
  GitCommitHorizontal,
  type LucideIcon,
  PencilLine,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import { Fragment, type RefObject, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  actionInput,
  expectationFor,
  GIT_MENU,
  type GitAction,
  type GitMenuAction,
  gitActionBlocker,
  type PullStrategy,
  primaryGitAction,
  pullNeedsStrategy,
  type Receipt,
  receiptFailed,
} from '../../domain/git-action';
import { shortOid } from '../../domain/history';
import { worktreeLabel } from '../../domain/inventory';
import { basename, changedFiles, type ReviewScope } from '../../domain/review';
import { useGitActions } from '../../query/git-actions';
import { useChanges, useRefreshChanges } from '../../query/review';
import {
  notifyFailure,
  notifySuccess,
  reportFailure,
} from '../workspace/notify';
import { usePreferences } from '../workspace/preferences';
import { BranchDialog } from './branch-dialog';
import { CommitDialog } from './commit-dialog';
import { ConflictGuidance } from './conflict-guidance';
import { FileTypeIcon } from './file-type-icon';
import {
  changedSinceLooked,
  conflictedPaths,
  type Look,
  plural,
  receiptWords,
  reportFailedReceipt,
} from './git-feedback';
import { LookAgainButton } from './look-again';
import type { OpenDocument } from './review-workspace';

const ICONS: Record<GitMenuAction, LucideIcon> = {
  commit: GitCommitHorizontal,
  amend: PencilLine,
  push: ArrowUp,
  pull: ArrowDown,
  fetch: RefreshCw,
  'stash-create': Archive,
  'stash-pop': ArchiveRestore,
  'switch-branch': GitBranch,
  'create-branch': GitBranchPlus,
};

/** A separator goes after these, so the menu reads commit / sync / stash / branches. */
const ENDS_SECTION: readonly GitMenuAction[] = ['amend', 'fetch', 'stash-pop'];

type Network = 'fetch' | 'pull' | 'push';
const isNetwork = (action: GitAction): action is Network =>
  action === 'fetch' || action === 'pull' || action === 'push';

/** "Pushing to origin/main", for the progress popover and the button's tooltip. */
function runningTitle(action: Network, status: Look): string {
  const upstream = status.branch.upstream;
  const remote = upstream?.split('/')[0] ?? 'origin';
  if (action === 'fetch') return `Fetching from ${remote}`;
  if (action === 'pull') return `Pulling from ${upstream ?? remote}`;
  return `Pushing to ${upstream ?? `${remote}/${worktreeLabel(status.branch.name)}`}`;
}

/** The success toast: what happened, then Git's last words or what moved. */
function reportDone(action: GitAction, receipt: Receipt, looked: Look) {
  const lastLine = receipt.progress.at(-1);
  const upstream = looked.branch.upstream ?? 'upstream';
  if (receipt.state === 'no-change') {
    const title =
      action === 'push'
        ? 'Nothing to push'
        : action === 'stash-create'
          ? 'Nothing to stash'
          : 'Already up to date';
    toast.add({
      title,
      description: isNetwork(action)
        ? `Nothing new on ${upstream}.`
        : undefined,
      type: 'info',
    });
    return;
  }
  const result = receipt.result;
  switch (action) {
    case 'fetch':
      notifySuccess(`Fetched from ${upstream.split('/')[0]}`, lastLine);
      return;
    case 'pull':
      notifySuccess(
        `Pulled from ${upstream}`,
        lastLine ??
          (result?.headOid == null
            ? undefined
            : `HEAD is now ${shortOid(result.headOid)}`),
      );
      return;
    case 'push':
      notifySuccess(
        `Pushed to ${result?.destinationRef ?? upstream}`,
        lastLine,
      );
      return;
    case 'stash-create':
      notifySuccess(
        `Stashed ${plural(changedFiles(looked.changes).length, 'file')}`,
        result?.stashOid == null
          ? 'Pop it from the Git menu.'
          : `Stash ${shortOid(result.stashOid)}. Pop it from the Git menu.`,
      );
      return;
    case 'stash-pop':
      notifySuccess('Popped the stash', looked.branch.stashes[0]?.message);
      return;
    default:
      notifySuccess('Done');
  }
}

type Confirming = {
  action: 'stash-create' | 'stash-pop';
  /** What the dialog shows and sends as `expected`; null follows the live list after a refusal. */
  looked: Look | null;
  /** Why the last try was refused. */
  refusal: string | null;
};

/**
 * t3code's split button, beside the surface tabs: the primary half does the likely
 * next thing (commit, else pull, else push); the chevron lists every action, blocked
 * ones dimmed with the reason. Fetch, pull and push run straight away and show Git's
 * progress in a small popover under the button; stash and pop stash confirm first.
 * Every action sends what the reviewer saw, and a "changed since you looked" refusal
 * offers to look again. While Git has a merge or rebase stopped on a conflict, the
 * primary half (and the top of the menu) opens how to finish or back out of it.
 */
export function GitButton({
  scope,
  onOpen,
}: {
  scope: ReviewScope;
  onOpen?: OpenDocument;
}) {
  const status = useChanges(scope);
  const refresh = useRefreshChanges(scope);
  const { preferences } = usePreferences();
  const git = useGitActions(scope);
  const [menuOpen, setMenuOpen] = useState(false);
  const [committing, setCommitting] = useState<'single' | 'amend' | null>(null);
  const [branching, setBranching] = useState<'switch' | 'create' | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  // A merge or rebase Git stopped on a conflict: the button leads to how to finish it.
  const stopped = status.inProgress;
  const conflicted = conflictedPaths(status);
  if (guidanceOpen && stopped == null) setGuidanceOpen(false);

  // Operations live beside the connection, so a push started before a remount still shows here.
  const network = git.running.find((operation) => isNetwork(operation.action));
  const running = git.running.length > 0;
  const branch = status.branch;
  const primary = primaryGitAction(status, preferences.pullStrategy);
  const PrimaryIcon =
    stopped != null
      ? TriangleAlert
      : primary.kind === 'run'
        ? ICONS[primary.action]
        : primary.label === 'Pull'
          ? ICONS.pull
          : ICONS.commit;
  const upstream = branch.upstream ?? 'upstream';
  const networkTitle =
    network == null || !isNetwork(network.action)
      ? null
      : runningTitle(network.action, status);
  const tip =
    networkTitle != null
      ? networkTitle
      : running
        ? 'A Git action is running…'
        : stopped != null
          ? conflicted.length > 0
            ? `The ${stopped} stopped on a conflict in ${plural(conflicted.length, 'file')}. Show how to finish`
            : stopped === 'merge'
              ? 'The merge is ready: commit to finish it'
              : 'The rebase is waiting to continue'
          : primary.kind === 'hint'
            ? primary.hint
            : primary.kind === 'commit'
              ? `Commit ${plural(changedFiles(status.changes).length, 'changed file')}`
              : primary.action === 'pull'
                ? `Pull ${plural(branch.behind, 'commit')} from ${upstream}`
                : `Push ${plural(branch.ahead, 'commit')} to ${upstream}`;

  const runNetwork = (
    action: Network,
    pullStrategy: PullStrategy = preferences.pullStrategy,
  ) => {
    const looked = status;
    setProgressOpen(true);
    reportFailure(
      git
        .run(actionInput(action, looked, pullStrategy), expectationFor(looked))
        .then((receipt) => {
          setProgressOpen(false);
          // Stopped on a conflict: read the list again, then say how to finish, under the button.
          if (receipt.state === 'conflicted' && action === 'pull')
            void refresh().then(() => setGuidanceOpen(true));
          // Look again: re-read the branch and the list, then show them in the menu.
          else if (receiptFailed(receipt))
            reportFailedReceipt(
              action,
              receipt,
              () => void refresh().then(() => setMenuOpen(true)),
            );
          else reportDone(action, receipt, looked);
        }),
      `${action === 'fetch' ? 'Fetch' : action === 'pull' ? 'Pull' : 'Push'} did not run`,
    );
  };

  const choose = (action: GitMenuAction) => {
    switch (action) {
      case 'commit':
        setCommitting('single');
        return;
      case 'amend':
        setCommitting('amend');
        return;
      case 'switch-branch':
        setBranching('switch');
        return;
      case 'create-branch':
        setBranching('create');
        return;
      case 'stash-create':
      case 'stash-pop':
        // Confirms with what the list shows now, and sends exactly that.
        setConfirming({ action, looked: status, refusal: null });
        return;
      default:
        runNetwork(action);
    }
  };

  const confirmRun = () => {
    if (confirming == null || confirmPending) return;
    const { action } = confirming;
    const looked = confirming.looked ?? status;
    const paths = action === 'stash-create' ? changedFiles(looked.changes) : [];
    setConfirmPending(true);
    git
      .run(
        actionInput(action, looked, preferences.pullStrategy),
        expectationFor(looked, paths),
      )
      .then((receipt) => {
        if (changedSinceLooked(receipt)) {
          // Stay open on the live list, read again now, saying what moved; confirming again sends the new look.
          setConfirming({
            action,
            looked: null,
            refusal: receiptWords(receipt),
          });
          void refresh();
          return;
        }
        setConfirming(null);
        if (receiptFailed(receipt)) reportFailedReceipt(action, receipt);
        else reportDone(action, receipt, looked);
      })
      .catch((error: unknown) => {
        setConfirming(null);
        notifyFailure(
          `${action === 'stash-pop' ? 'Pop stash' : 'Stash'} did not run`,
          error,
        );
      })
      .finally(() => setConfirmPending(false));
  };

  const shown = confirming == null ? null : (confirming.looked ?? status);

  return (
    // biome-ignore lint/a11y/useSemanticElements: a split button, not a form; a fieldset would add form semantics
    <div
      ref={anchor}
      role="group"
      aria-label="Git actions"
      className="flex shrink-0"
    >
      {/* While the progress popover is open it says the same thing, so the tooltip steps aside. */}
      <Tooltip
        disabled={
          (progressOpen && network != null) || (guidanceOpen && stopped != null)
        }
      >
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon-sm"
              // Icon only: the icon names the action, the tooltip says what it will do.
              aria-label={
                network != null
                  ? `${networkTitle}: show progress`
                  : stopped != null
                    ? `How to finish the ${stopped}`
                    : primary.label
              }
              // Stays hoverable while disabled, so the tooltip can say why. A running
              // fetch, pull or push keeps it clickable: it opens the progress again.
              disabled={
                network == null &&
                stopped == null &&
                (primary.kind === 'hint' || running)
              }
              focusableWhenDisabled
              className="rounded-e-none border-e-0 aria-disabled:cursor-default aria-disabled:opacity-60 aria-disabled:hover:bg-background dark:aria-disabled:hover:bg-transparent"
              onClick={() => {
                if (network != null) setProgressOpen((current) => !current);
                else if (stopped != null)
                  setGuidanceOpen((current) => !current);
                else if (primary.kind === 'commit') setCommitting('single');
                else if (primary.kind === 'run') runNetwork(primary.action);
              }}
            />
          }
        >
          {running ? (
            <Spinner className="size-3.5" />
          ) : (
            <PrimaryIcon
              className={cn(
                'size-3.5',
                stopped != null && 'text-amber-600 dark:text-amber-400',
              )}
            />
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-72">
          <span className="flex min-w-0 flex-col gap-0.5">
            {tip}
            {network != null && network.progress.length > 0 && (
              <span className="font-mono text-[11px] opacity-70">
                {network.progress.at(-1)}
              </span>
            )}
          </span>
        </TooltipContent>
      </Tooltip>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Git actions menu"
              className="rounded-s-none"
              disabled={running}
            />
          }
        >
          <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-1.5">
              <GitBranch className="size-3.5 shrink-0" />
              <span className="truncate">{worktreeLabel(branch.name)}</span>
              {branch.upstream != null && (
                <span className="ml-auto shrink-0 tabular-nums">
                  {branch.ahead} ahead · {branch.behind} behind
                </span>
              )}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {stopped != null && (
            <>
              <DropdownMenuItem
                onClick={() => setGuidanceOpen(true)}
                className="items-start"
              >
                <TriangleAlert className="mt-0.5 text-amber-600 dark:text-amber-400" />
                <span className="flex min-w-0 flex-col">
                  <span>
                    {conflicted.length > 0
                      ? `${stopped === 'merge' ? 'Merge' : 'Rebase'} stopped on a conflict`
                      : `${stopped === 'merge' ? 'Merge' : 'Rebase'} in progress`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {conflicted.length > 0 &&
                      `${plural(conflicted.length, 'conflicted file')} · `}
                    How to finish
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {GIT_MENU.map(({ action, label }) => {
            const blocker = gitActionBlocker(
              action,
              status,
              preferences.pullStrategy,
            );
            const Icon = ICONS[action];
            return (
              <Fragment key={action}>
                <DropdownMenuItem
                  disabled={blocker != null}
                  onClick={() => choose(action)}
                  // Only the label dims: the reason underneath has to stay readable.
                  className="items-start data-disabled:opacity-100"
                >
                  <Icon
                    className={cn('mt-0.5', blocker != null && 'opacity-50')}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className={cn(blocker != null && 'opacity-50')}>
                      {label}
                    </span>
                    {blocker != null && (
                      <span className="text-xs text-muted-foreground">
                        {blocker}
                      </span>
                    )}
                  </span>
                </DropdownMenuItem>
                {action === 'pull' &&
                  pullNeedsStrategy(status, preferences.pullStrategy) &&
                  (['merge', 'rebase'] as const).map((strategy) => (
                    <DropdownMenuItem
                      key={strategy}
                      onClick={() => runNetwork('pull', strategy)}
                      className="items-start pl-8"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span>Pull with {strategy}</span>
                        <span className="text-xs text-muted-foreground">
                          {strategy === 'merge'
                            ? 'Adds a merge commit.'
                            : 'Replays your commits on top.'}{' '}
                          Just this once.
                        </span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                {ENDS_SECTION.includes(action) && <DropdownMenuSeparator />}
              </Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <ProgressPopover
        anchor={anchor}
        open={progressOpen && network != null}
        onClose={() => setProgressOpen(false)}
        title={networkTitle ?? ''}
        lines={network?.progress ?? []}
      />
      {stopped != null && (
        <ConflictGuidance
          anchor={anchor}
          open={guidanceOpen}
          onClose={() => setGuidanceOpen(false)}
          status={{ ...status, inProgress: stopped }}
          onOpen={onOpen}
          onCommit={() => {
            setGuidanceOpen(false);
            setCommitting('single');
          }}
        />
      )}

      <CommitDialog
        scope={scope}
        open={committing != null}
        mode={committing ?? 'single'}
        onOpenChange={(open) => !open && setCommitting(null)}
      />
      <BranchDialog
        scope={scope}
        open={branching != null}
        mode={branching ?? 'switch'}
        onOpenChange={(open) => !open && setBranching(null)}
      />

      <AlertDialog
        open={confirming != null}
        onOpenChange={(open) => {
          if (!open && !confirmPending) setConfirming(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              {confirming?.action === 'stash-pop' ? (
                <ArchiveRestore />
              ) : (
                <Archive />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {confirming?.action === 'stash-pop'
                ? 'Pop the latest stash?'
                : `Stash ${plural(changedFiles(shown?.changes ?? []).length, 'changed file')}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.action === 'stash-pop'
                ? 'Its changes come back into the working tree and the stash is dropped.'
                : 'Every change, new files included, is set aside until you pop the stash. The review stays empty meanwhile.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {shown != null && confirming != null && (
            <ConfirmDetails action={confirming.action} status={shown} />
          )}
          {confirming?.refusal != null && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-800 dark:text-amber-200"
            >
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 flex-1">
                {confirming.refusal} The list above shows it as it is now;
                confirm again if it still looks right.
              </span>
              <LookAgainButton onLook={refresh} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              disabled={confirmPending || shown == null}
              onClick={confirmRun}
            >
              {confirmPending ? (
                <Spinner />
              ) : confirming?.action === 'stash-pop' ? (
                <ArchiveRestore />
              ) : (
                <Archive />
              )}
              {confirming?.action === 'stash-pop'
                ? 'Pop stash'
                : 'Stash changes'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** What stashing or popping will touch, straight from the list of changes. */
function ConfirmDetails({
  action,
  status,
}: {
  action: 'stash-create' | 'stash-pop';
  status: Look;
}) {
  const stash = status.branch.stashes[0];
  if (action === 'stash-pop') {
    return (
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 rounded-xl bg-muted/50 px-3 py-2.5 text-[12.5px]">
        <dt className="text-muted-foreground">Stash</dt>
        <dd className="min-w-0 truncate">{stash?.message ?? 'None'}</dd>
        {stash != null && (
          <>
            <dt className="text-muted-foreground">Id</dt>
            <dd className="font-mono">{shortOid(stash.oid)}</dd>
          </>
        )}
        {status.branch.stashes.length > 1 && (
          <>
            <dt className="text-muted-foreground">Left after</dt>
            <dd>{plural(status.branch.stashes.length - 1, 'stash')}</dd>
          </>
        )}
      </dl>
    );
  }
  const paths = changedFiles(status.changes);
  const listed = paths.slice(0, 4);
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-muted/50 px-3 py-2.5 text-[12.5px]">
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <GitBranch className="size-3.5 shrink-0" />
        <span className="truncate">{worktreeLabel(status.branch.name)}</span>
      </p>
      <ul className="flex flex-col gap-1">
        {listed.map((path) => (
          <li key={path} className="flex min-w-0 items-center gap-2">
            <FileTypeIcon path={path} className="size-4 shrink-0" />
            <span className="truncate" title={path}>
              {basename(path)}
            </span>
          </li>
        ))}
      </ul>
      {paths.length > listed.length && (
        <p className="text-muted-foreground">
          and {paths.length - listed.length} more
        </p>
      )}
    </div>
  );
}

/**
 * Git's progress while a fetch, pull or push runs, under the Git button. It opens
 * when the action starts, never takes focus, and closes itself at the end, when the
 * toast takes over. Clicking the spinning button opens it again.
 */
function ProgressPopover({
  anchor,
  open,
  onClose,
  title,
  lines,
}: {
  anchor: RefObject<HTMLDivElement | null>;
  open: boolean;
  onClose: () => void;
  title: string;
  lines: readonly string[];
}) {
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next, details) => {
        // A click on the Git button itself toggles it there, not here.
        const target = details.event?.target;
        if (
          !next &&
          !(target instanceof Node && anchor.current?.contains(target))
        )
          onClose();
      }}
    >
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={anchor}
          side="bottom"
          align="end"
          sideOffset={6}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            initialFocus={false}
            finalFocus={false}
            aria-live="polite"
            className="flex w-80 origin-(--transform-origin) flex-col gap-2 rounded-2xl bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-hidden duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 dark:ring-foreground/10"
          >
            <PopoverPrimitive.Title className="flex items-center gap-2 text-[12.5px] font-medium">
              <Spinner className="size-3.5" />
              <span className="truncate">{title}…</span>
            </PopoverPrimitive.Title>
            <ol className="flex flex-col gap-0.5 font-mono text-[11px] leading-4">
              {lines.length === 0 ? (
                <li className="text-muted-foreground">Waiting for Git…</li>
              ) : (
                lines.slice(-4).map((line, index, shownLines) => (
                  <li
                    key={line}
                    className={cn(
                      'truncate',
                      index < shownLines.length - 1 && 'text-muted-foreground',
                    )}
                    title={line}
                  >
                    {line}
                  </li>
                ))
              )}
            </ol>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
