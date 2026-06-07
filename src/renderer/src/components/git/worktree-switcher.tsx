import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { SidebarMenuButton } from '@renderer/components/ui/sidebar'
import { useBranch, useWorktrees } from '@renderer/hooks/use-worktrees'
import { useRepoStore } from '@renderer/stores/repo'
import { Check, GitBranch } from 'lucide-react'

export function WorktreeSwitcher(): React.JSX.Element | null {
  const repo = useRepoStore((s) => s.repo)
  const switchTo = useRepoStore((s) => s.switchTo)
  const branch = useBranch()
  const worktrees = useWorktrees()

  if (!repo) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton className="app-no-drag">
            <GitBranch className="text-muted-foreground" />
            <span className="truncate">{branch ?? '…'}</span>
          </SidebarMenuButton>
        }
      />
      <DropdownMenuContent side="top" align="start" className="w-72">
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
