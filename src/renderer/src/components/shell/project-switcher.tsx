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
import { useRecentRepos } from '@renderer/hooks/use-repo'
import { useRepoStore } from '@renderer/stores/repo'
import { Check, ChevronsUpDown, FolderOpen } from 'lucide-react'

// The project lives at the top of the icon rail as an avatar (its initial) with a
// switch-chevron badge — the same dropdown the old header chip carried, just a
// denser trigger that sits above the tab icons.
export function ProjectSwitcher(): React.JSX.Element | null {
  const repo = useRepoStore((s) => s.repo)
  const openRepo = useRepoStore((s) => s.openRepo)
  const switchTo = useRepoStore((s) => s.switchTo)
  const recents = useRecentRepos(repo !== null)

  if (!repo) return null

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Switch project"
                  className="app-no-drag relative flex size-9 items-center justify-center rounded-lg bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground hover:bg-accent"
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
      <DropdownMenuContent align="start" side="right" className="w-72">
        {/* Base UI requires GroupLabel inside a Group (Radix did not) */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Recent projects</DropdownMenuLabel>
          {recents.map((recent) => (
            <DropdownMenuItem key={recent.path} onClick={() => switchTo(recent.path)}>
              {recent.path === repo.path ? (
                <Check className="shrink-0" />
              ) : (
                <span className="size-4 shrink-0" />
              )}
              <div className="flex min-w-0 flex-col">
                <span className="truncate">{recent.name}</span>
                <span className="truncate text-xs text-muted-foreground" dir="rtl">
                  {recent.path}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={openRepo}>
            <FolderOpen className="shrink-0" />
            Open another repository…
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
