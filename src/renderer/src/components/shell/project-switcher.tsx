import { DropdownMenuTrigger } from '@renderer/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useRepoStore } from '@renderer/stores/repo'
import { ChevronsUpDown } from 'lucide-react'
import { ProjectSwitcherMenu } from './project-switcher-menu'

// The project lives at the top of the icon rail as an avatar (its initial) with a
// switch-chevron badge — the one trigger for the ProjectSwitcherMenu (the Projects
// surface), a dense chip that sits above the tab icons. The menu opens to the
// right of the rail.
export function ProjectSwitcher(): React.JSX.Element | null {
  const repo = useRepoStore((s) => s.repo)

  if (!repo) return null

  return (
    <ProjectSwitcherMenu
      trigger={
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
      }
    />
  )
}
