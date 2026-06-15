import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { useRecentRepos } from '@renderer/hooks/use-repo'
import { useRepoStore } from '@renderer/stores/repo'
import { Check, ChevronsUpDown, FolderOpen } from 'lucide-react'

export function ProjectSwitcher(): React.JSX.Element | null {
  const repo = useRepoStore((s) => s.repo)
  const openRepo = useRepoStore((s) => s.openRepo)
  const switchTo = useRepoStore((s) => s.switchTo)
  const recents = useRecentRepos(repo !== null)

  if (!repo) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="app-no-drag flex w-full min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <span className="truncate">{repo.name}</span>
            <ChevronsUpDown className="size-3 shrink-0" />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-72">
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
