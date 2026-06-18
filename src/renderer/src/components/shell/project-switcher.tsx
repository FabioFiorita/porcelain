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
import { Check, ChevronsUpDown, FolderPlus } from 'lucide-react'

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
                  className="app-no-drag relative flex size-10 items-center justify-center rounded-xl bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
          <DropdownMenuLabel className="uppercase tracking-wider text-muted-foreground">
            Projects
          </DropdownMenuLabel>
          {recents.map((recent) => (
            <DropdownMenuItem key={recent.path} onClick={() => switchTo(recent.path)}>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
                {recent.name.charAt(0).toUpperCase()}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate">{recent.name}</span>
                <span className="truncate text-xs text-muted-foreground" dir="rtl">
                  {recent.path}
                </span>
              </div>
              {recent.path === repo.path && <Check className="ml-auto shrink-0 text-success" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={openRepo}>
            <FolderPlus className="shrink-0" />
            Open project…
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
