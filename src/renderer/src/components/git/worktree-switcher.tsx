import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { SidebarMenuButton } from '@renderer/components/ui/sidebar'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'
import { Check, GitBranch } from 'lucide-react'

export function WorktreeSwitcher(): React.JSX.Element | null {
  const repo = useRepoStore((s) => s.repo)
  const openRepoPath = useRepoStore((s) => s.openRepoPath)
  const { data: branch } = trpc.gitBranch.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
    staleTime: 0,
    refetchInterval: 5000,
  })
  const { data: worktrees = [] } = trpc.gitWorktrees.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
  })

  if (!repo) return null

  const switchTo = async (path: string): Promise<void> => {
    if (path === repo.path) return
    useTabsStore.setState({ tabs: [], activeTabId: null })
    await openRepoPath(path)
  }

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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
