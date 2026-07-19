import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useNewWindow, useRecentRepos, useRemoveRecentRepo } from '@renderer/hooks/use-repo'
import { isBrowser } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { Check, ChevronsUpDown, FolderPlus, SquareArrowOutUpRight, X } from 'lucide-react'
import { useState } from 'react'

// The project lives at the top of the icon rail as an avatar (its initial) with a
// switch-chevron badge — the same dropdown the old header chip carried, just a
// denser trigger that sits above the tab icons.
export function ProjectSwitcher(): React.JSX.Element | null {
  const repo = useRepoStore((s) => s.repo)
  const openRepo = useRepoStore((s) => s.openRepo)
  const switchTo = useRepoStore((s) => s.switchTo)
  const newWindow = useNewWindow()
  const removeRecent = useRemoveRecentRepo()
  const recents = useRecentRepos(repo !== null)
  const [menuOpen, setMenuOpen] = useState(false)

  if (!repo) return null

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Switch project"
                  // A secondary-surface chip so the avatar reads as a distinct
                  // badge on the rail.
                  className="app-no-drag relative flex size-10 items-center justify-center rounded-md border bg-secondary text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {repo.name.charAt(0).toUpperCase()}
                  <span className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full border bg-card text-muted-foreground">
                    <ChevronsUpDown className="size-2" />
                  </span>
                </button>
              }
            />
          }
        />
        <TooltipContent side="right">{repo.name}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" side="right" className="w-64">
        {/* Base UI requires GroupLabel inside a Group (Radix did not) */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          {recents.map((recent) => (
            <DropdownMenuItem key={recent.path} onClick={() => switchTo(recent.path)}>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
                {recent.name.charAt(0).toUpperCase()}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate">{recent.name}</span>
                <span className="truncate font-mono text-2xs-plus text-muted-foreground" dir="rtl">
                  {recent.path}
                </span>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                {recent.path === repo.path && <Check className="shrink-0 text-success" />}
                {/* Open in a fresh window without switching this one — stopPropagation
                    keeps the row's switchTo from also firing. Shell-only: the browser
                    client can't spawn Electron windows. */}
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
                      newWindow.openWindow(recent.path)
                    }}
                  >
                    <SquareArrowOutUpRight className="size-3.5" />
                  </button>
                )}
                {/* Prune a stale project from the list — stopPropagation keeps the row's
                    switchTo from firing, and we deliberately leave the menu open so the
                    user can remove several in a row. Never offered for the open repo (that
                    row shows the check — you can't drop the project you're standing in). */}
                {recent.path !== repo.path && (
                  <button
                    type="button"
                    aria-label="Remove from projects"
                    className={cn(
                      'flex size-6 items-center justify-center rounded-md text-muted-foreground',
                      'hover:bg-accent/50 hover:text-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeRecent.remove(recent.path)
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={openRepo}>
            <FolderPlus className="shrink-0" />
            Open project…
          </DropdownMenuItem>
          {/* A fresh window is an Electron-shell action — hidden in the browser client. */}
          {!isBrowser && (
            <DropdownMenuItem onClick={() => newWindow.openWindow()}>
              <SquareArrowOutUpRight className="shrink-0" />
              New window
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
