import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@renderer/components/ui/empty'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@renderer/components/ui/sidebar'
import { useGitLog } from '@renderer/features/git'
import { targetedTab } from '@renderer/stores/hub-tabs'
import { useTabsStore } from '@renderer/stores/tabs'
import { History as HistoryIcon } from 'lucide-react'
import { CommitContextMenu } from './commit-context-menu'

export function HistoryList(): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const activeCommitHash = useTabsStore((s) => {
    const pane = s.panes[s.activePaneIndex]
    const tab = pane?.tabs.find((candidate) => candidate.id === pane.activeTabId)
    return tab?.kind === 'commit' ? tab.path : null
  })
  const commits = useGitLog(200)

  if (commits === undefined) {
    return <p className="p-3 text-sm text-muted-foreground">Loading…</p>
  }

  if (commits.length === 0) {
    return (
      <Empty className="mx-2 mt-1 min-h-36 border-none bg-muted/20 px-4 py-8">
        <EmptyMedia>
          <HistoryIcon />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No commits yet</EmptyTitle>
          <EmptyDescription>Commits on this branch will show up here as you work.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <SidebarMenu>
      {commits.map((commit) => (
        <SidebarMenuItem key={commit.hash}>
          <CommitContextMenu commit={commit}>
            <SidebarMenuButton
              className="h-auto py-1 text-sm-minus"
              isActive={activeCommitHash === commit.hash}
              onClick={() =>
                openTab(targetedTab('commit', commit.hash, { title: commit.subject.slice(0, 32) }))
              }
            >
              <div className="flex min-w-0 flex-col items-start">
                <span className="max-w-full truncate">{commit.subject}</span>
                <span className="max-w-full truncate text-xs text-muted-foreground">
                  {commit.author} · {commit.date} ·{' '}
                  <span className="font-mono">{commit.hash.slice(0, 7)}</span>
                </span>
              </div>
            </SidebarMenuButton>
          </CommitContextMenu>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
