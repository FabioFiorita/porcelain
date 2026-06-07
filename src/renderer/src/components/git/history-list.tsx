import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@renderer/components/ui/sidebar'
import { useGitLog } from '@renderer/hooks/use-history'
import { tabId, useTabsStore } from '@renderer/stores/tabs'

export function HistoryList(): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const commits = useGitLog(200)

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
                id: tabId('commit', commit.hash),
                kind: 'commit',
                title: commit.subject.slice(0, 32),
                path: commit.hash,
              })
            }
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
