import {
  CircleAlertIcon,
  CopyIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  HouseIcon,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/shared/lib/utils';
import { copyText } from '@/shared/workspace/copy';
import { worktreeLabel, type Project } from '../rules/inventory';

type Worktree = Project['worktrees'][number];

function worktreeDisplayLabel(worktree: Worktree) {
  return worktreeLabel(worktree.branch);
}

const STATUS_LABEL = {
  pending: 'Waiting for your review',
  reviewed: 'Reviewed, waiting for a commit',
  replied: 'The agent replied',
} as const;

const STATUS_STYLE = {
  pending: 'bg-yellow-500',
  reviewed: 'bg-graph-2',
  replied: 'bg-blue-500',
} as const;

export function WorktreeRow({
  worktree,
  projectName,
  selected,
  onSelect,
}: {
  worktree: Worktree;
  projectName: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = worktree.main
    ? HouseIcon
    : worktree.branch === null
      ? GitCommitHorizontalIcon
      : GitBranchIcon;
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            type="button"
            aria-pressed={selected}
            aria-current={selected ? 'page' : undefined}
            data-unavailable={!worktree.available || undefined}
            onClick={() => onSelect(worktree.id)}
            className={cn(
              'flex w-full min-w-0 items-center gap-1.5 rounded-lg py-1.5 pr-2 pl-7 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              selected && 'bg-accent font-medium text-foreground',
              !worktree.available && 'opacity-60',
            )}
          />
        }
      >
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate">{worktreeDisplayLabel(worktree)}</span>
          <span className="sr-only">{worktree.path}</span>
          <span className="sr-only">{projectName}</span>
          {!worktree.available && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <CircleAlertIcon className="size-3" aria-hidden="true" />
              Unavailable
            </span>
          )}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {worktree.status && (
            <span
              className={cn(
                'size-2 rounded-full',
                STATUS_STYLE[worktree.status],
              )}
              role="img"
              title={STATUS_LABEL[worktree.status]}
              aria-label={STATUS_LABEL[worktree.status]}
            />
          )}
          {worktree.main && <span className="sr-only">Main worktree</span>}
        </span>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-44">
        <ContextMenuItem
          onClick={() =>
            copyText(worktreeDisplayLabel(worktree), 'branch name')
          }
          disabled={worktree.branch == null}
        >
          <GitBranchIcon />
          Copy name
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => copyText(worktree.path, 'worktree path')}
        >
          <CopyIcon />
          Copy path
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
