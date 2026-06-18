import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { useWorktrees } from '@renderer/hooks/use-worktrees'
import { useRepoStore } from '@renderer/stores/repo'
import { Check, ChevronsUpDown, Folder } from 'lucide-react'

// The footer's right chip: the worktree count, opening the list to switch the whole
// worktree (its checked-out branch + directory). The left chip (BranchSwitcher) does
// in-place branch checkout instead — two distinct controls, no shared menu.
export function WorktreeSwitcher(): React.JSX.Element | null {
  const repo = useRepoStore((s) => s.repo)
  const switchTo = useRepoStore((s) => s.switchTo)
  const worktrees = useWorktrees()

  if (!repo) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="app-no-drag flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Folder className="size-3.5 shrink-0" />
            <span>
              {worktrees.length} worktree{worktrees.length === 1 ? '' : 's'}
            </span>
            <ChevronsUpDown className="size-3 shrink-0" />
          </button>
        }
      />
      <DropdownMenuContent side="top" align="end" className="w-72">
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
