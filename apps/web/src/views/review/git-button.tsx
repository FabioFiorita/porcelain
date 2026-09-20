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
import type { GitAction } from '../../domain/git-action';
import { comparisons, type ReviewScope } from '../../domain/review';
import { useReviewOverview } from '../../query/review';
import { GitActionInspection } from './git-action-inspection';
import {
  branchStatus,
  gitActionBlocker,
  gitActionGroups,
  gitActionReason,
  gitActions,
  primaryGitAction,
} from './git-action-options';

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
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<GitAction | null>(null);
  if (overview == null) return null;
  // What an action needs to be decided; the panel reads the rest when it opens.
  const status = {
    statusToken: overview.changes.statusToken,
    branch: overview.changes.branch,
    changes: comparisons(overview.changes),
  };
  const selected = gitActions.find((candidate) => candidate.id === action);
  const primary = primaryGitAction(status);
  const PrimaryIcon =
    primary.kind === 'run' ? ICONS[primary.action] : GitCommitHorizontalIcon;
  const primaryTip = primaryTooltip(primary, status);
  const branch = branchStatus(status);

  const choose = (next: GitAction) => setAction(next);

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
            else if (primary.kind === 'run') choose(primary.action);
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

      {action != null && (
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
                  : (selected?.label ?? 'Git action')}
              </DialogTitle>
              <DialogDescription>
                {selected?.id === 'commit'
                  ? 'Choose the files and message for this commit.'
                  : 'Prepare and review the operation before confirming it.'}
              </DialogDescription>
            </DialogHeader>
            <GitActionInspection
              scope={scope}
              entry={action}
              status={status}
              onBusy={setBusy}
            />
          </DialogContent>
        </Dialog>
      )}
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
