import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@renderer/components/ui/sidebar'
import { useFileLog } from '@renderer/hooks/use-history'
import { fileName } from '@renderer/lib/paths'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { CommitContextMenu } from '../git/commit-context-menu'

// The timeline tracks whatever file you're viewing: file and diff tabs carry a
// file path, every other tab kind (commit/board/terminal/…) has nothing to time.
function useActiveFilePath(): string | null {
  return useTabsStore((s) => {
    const pane = s.panes[s.activePaneIndex]
    const tab = pane?.tabs.find((t) => t.id === pane.activeTabId)
    return tab && (tab.kind === 'file' || tab.kind === 'diff') ? tab.path : null
  })
}

// The History tab's file timeline: the commit history of the file open in the
// viewer — who changed it, when, and in which commit. Clicking a row opens that
// commit, the same as the History list, so the entry reads alongside the change.
export function FileTimelineGroup(): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const filePath = useActiveFilePath()
  const commits = useFileLog(filePath)

  return (
    <SidebarGroup className="px-3">
      <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        File timeline
      </SidebarGroupLabel>
      <SidebarGroupContent className="px-1">
        {filePath === null ? (
          <p className="px-1 py-1 text-xs text-muted-foreground">
            Open a file to see its timeline.
          </p>
        ) : commits === undefined ? (
          <p className="px-1 py-1 text-xs text-muted-foreground">Loading…</p>
        ) : commits.length === 0 ? (
          <p className="px-1 py-1 text-xs text-muted-foreground">No history for this file yet.</p>
        ) : (
          <>
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
                          {commit.author} · {commit.date} ·{' '}
                          <span className="font-mono">{commit.hash.slice(0, 7)}</span>
                        </span>
                      </div>
                    </SidebarMenuButton>
                  </CommitContextMenu>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
