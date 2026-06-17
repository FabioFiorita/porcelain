import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { useBranch, useWorktrees } from '@renderer/hooks/use-worktrees'
import { useRepoStore } from '@renderer/stores/repo'
import { Check, ChevronsUpDown, FolderGit2, GitBranch } from 'lucide-react'

// The footer carries two reads of the same worktree list: the current branch on
// the left, the worktree count on the right. A worktree IS a branch here (there is
// no bare `git checkout`), so both triggers open the same switcher — picking a
// worktree is how you change branch.
export function WorktreeSwitcher({
  variant = 'branch',
}: {
  variant?: 'branch' | 'count'
}): React.JSX.Element | null {
  const repo = useRepoStore((s) => s.repo)
  const switchTo = useRepoStore((s) => s.switchTo)
  const branch = useBranch()
  const worktrees = useWorktrees()

  if (!repo) return null

  const trigger =
    variant === 'count' ? (
      <button
        type="button"
        className="app-no-drag flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <FolderGit2 className="size-3.5 shrink-0" />
        <span>
          {worktrees.length} worktree{worktrees.length === 1 ? '' : 's'}
        </span>
        <ChevronsUpDown className="size-3 shrink-0" />
      </button>
    ) : (
      <button
        type="button"
        className="app-no-drag flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <GitBranch className="size-3.5 shrink-0" />
        <span className="truncate">{branch ?? '…'}</span>
      </button>
    )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent
        side="top"
        align={variant === 'count' ? 'end' : 'start'}
        className="w-72"
      >
        {/* Base UI requires GroupLabel inside a Group (Radix did not) */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Worktrees</DropdownMenuLabel>
          {worktrees.map((worktree) => (
            <DropdownMenuItem key={worktree.path} onClick={() => switchTo(worktree.path)}>
              {worktree.path === repo.path ? (
                <Check className="shrink-0" />
              ) : (
                <span className="size-4 shrink-0" />
              )}
              <div className="flex min-w-0 flex-col">
                <span className="truncate">{worktree.branch}</span>
                <span className="truncate text-xs text-muted-foreground" dir="rtl">
                  {worktree.path}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
