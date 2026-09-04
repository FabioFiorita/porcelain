import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@renderer/components/ui/empty'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@renderer/components/ui/sidebar'
import { useFileLog } from '@renderer/features/git'
import { fileName } from '@renderer/lib/paths'
import { HubRepoProvider } from '@renderer/stores/hub-repo'
import { useHubTarget } from '@renderer/stores/hub-selection'
import { activeTabTarget, targetedTab } from '@renderer/stores/hub-tabs'
import { useTabsStore } from '@renderer/stores/tabs'
import { useActiveViewerFileContext } from '@renderer/stores/viewer-file-context'
import { History } from 'lucide-react'
import { CommitContextMenu } from '../git/commit-context-menu'

// The History tab's file timeline: the commit history of the file open in the
// viewer — who changed it, when, and in which commit. Clicking a row opens that
// commit, the same as the History list, so the entry reads alongside the change.
export function FileTimelineGroup(): React.JSX.Element {
  const active = useActiveViewerFileContext()
  const selectedTarget = useHubTarget()
  return (
    <HubRepoProvider target={active?.target ?? selectedTarget}>
      <FileTimelineContent filePath={active?.path ?? null} />
    </HubRepoProvider>
  )
}

function FileTimelineContent({ filePath }: { filePath: string | null }): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const commits = useFileLog(filePath)

  if (filePath === null) {
    return (
      <Empty className="mx-2 mt-2 min-h-36 border-none bg-muted/20 px-4 py-8">
        <EmptyMedia>
          <History />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No file selected</EmptyTitle>
          <EmptyDescription>Open a file to see its timeline.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (commits === undefined) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
  }

  if (commits.length === 0) {
    return (
      <Empty className="mx-2 mt-2 min-h-36 border-none bg-muted/20 px-4 py-8">
        <EmptyMedia>
          <History />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No history yet</EmptyTitle>
          <EmptyDescription>{fileName(filePath)} has no recorded commits.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="px-2">
      <p className="truncate px-1 pb-1 font-mono text-2xs text-muted-foreground">
        {fileName(filePath)}
      </p>
      <SidebarMenu>
        {commits.map((commit) => (
          <SidebarMenuItem key={commit.hash}>
            <CommitContextMenu commit={commit}>
              <SidebarMenuButton
                className="h-auto py-1 text-sm-minus"
                onClick={() =>
                  openTab(
                    targetedTab(
                      'commit',
                      commit.hash,
                      { title: commit.subject.slice(0, 32) },
                      activeTabTarget(),
                    ),
                  )
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
    </div>
  )
}
