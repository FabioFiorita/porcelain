import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { useNewWindow } from '@renderer/hooks/use-repo'
import { useWorktrees } from '@renderer/hooks/use-worktrees'
import { isBrowser } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { Check, ChevronsUpDown, Folder, SquareArrowOutUpRight } from 'lucide-react'
import { useState } from 'react'

// The footer's right chip: the worktree count, opening the list to jump to a
// worktree. Mirrors the ProjectSwitcher's two-option pattern — clicking a row
// switches THIS window to that worktree (in place, via switchTo), while the
// trailing button opens it in a NEW window (this one — and its terminals — stays
// put), for working two worktrees side by side. The left chip (BranchSwitcher)
// does in-place branch checkout instead — two distinct controls, no shared menu.
export function WorktreeSwitcher(): React.JSX.Element | null {
  const repo = useRepoStore((s) => s.repo)
  const switchTo = useRepoStore((s) => s.switchTo)
  const newWindow = useNewWindow()
  const worktrees = useWorktrees()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!repo) return null

  const current = worktrees.find((w) => w.path === repo.path)
  // Which checkout you're on (U20); full count lives in the tooltip.
  const chipLabel = current?.branch ?? repo.name
  const chipTitle =
    worktrees.length <= 1
      ? 'This checkout'
      : `${worktrees.length} worktrees — ${current?.path ?? repo.path}`

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            title={chipTitle}
            className="app-no-drag flex min-w-0 max-w-36 shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Folder className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate font-mono">{chipLabel}</span>
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
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-mono">{worktree.branch}</span>
                <span className="truncate font-mono text-xs text-muted-foreground" dir="rtl">
                  {worktree.path}
                </span>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                {worktree.path === repo.path && <Check className="shrink-0 text-success" />}
                {/* Open in a fresh window without switching this one —
                    stopPropagation keeps the row's switchTo from also firing.
                    Shell-only: the browser client can't spawn Electron windows. */}
                {!isBrowser && (
                  <button
                    type="button"
                    aria-label="Open in new window"
                    className={cn(
                      'flex size-6 items-center justify-center rounded-md text-muted-foreground',
                      'hover:bg-accent/50 hover:text-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(false)
                      newWindow.openWindow(worktree.path)
                    }}
                  >
                    <SquareArrowOutUpRight className="size-3.5" />
                  </button>
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
