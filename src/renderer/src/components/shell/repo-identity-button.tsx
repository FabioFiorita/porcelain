import { DropdownMenuTrigger } from '@renderer/components/ui/dropdown-menu'
import { useRepoStore } from '@renderer/stores/repo'
import { ChevronsUpDown } from 'lucide-react'
import { ProjectSwitcherMenu } from './project-switcher-menu'

// The titlebar's repo-identity anchor: the open repo's base name, sitting at the
// left of the bar (after the macOS traffic-light spacer; far left on browser/Linux).
// It's a second, compact trigger for the SAME ProjectSwitcherMenu the rail avatar
// opens — clicking it drops the Projects surface below the button. Renders nothing
// on the welcome screen (no repo). Marked app-no-drag so it stays clickable inside
// the draggable bar, and kept compact so the bar keeps a generous drag area.
export function RepoIdentityButton(): React.JSX.Element | null {
  const repo = useRepoStore((s) => s.repo)

  if (!repo) return null

  return (
    <ProjectSwitcherMenu
      contentSide="bottom"
      contentAlign="start"
      trigger={
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Switch project"
              className="app-no-drag flex max-w-40 items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground text-sm transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="truncate font-medium">{repo.name}</span>
              <ChevronsUpDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
            </button>
          }
        />
      }
    />
  )
}
