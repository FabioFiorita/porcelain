import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@renderer/components/ui/sidebar'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'

export function HistoryList(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const { data: commits } = trpc.gitLog.useQuery(
    { repoPath: repo?.path ?? '', limit: 200 },
    { enabled: repo !== null, staleTime: 0 },
  )

  if (commits === undefined) {
    return <p className="p-3 text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <SidebarMenu>
      {commits.map((commit) => (
        <SidebarMenuItem key={commit.hash}>
          <SidebarMenuButton
            className="h-auto py-1"
            onClick={() =>
              openTab({
                id: `commit:${commit.hash}`,
                kind: 'commit',
                title: commit.subject.slice(0, 32),
                path: commit.hash,
              })
            }
            title={commit.subject}
          >
            <div className="flex min-w-0 flex-col items-start">
              <span className="max-w-full truncate">{commit.subject}</span>
              <span className="max-w-full truncate text-xs text-muted-foreground">
                {commit.author} · {commit.date} · {commit.hash.slice(0, 7)}
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
