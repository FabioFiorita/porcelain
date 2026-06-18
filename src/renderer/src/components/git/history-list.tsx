import type { Commit } from '@main/diff'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@renderer/components/ui/sidebar'
import { useFetchCommitMessage, useGitLog } from '@renderer/hooks/use-history'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { Copy, MessageSquare } from 'lucide-react'

function CommitContextMenu({
  commit,
  children,
}: {
  commit: Commit
  children: React.ReactNode
}): React.JSX.Element {
  const fetchMessage = useFetchCommitMessage()

  const copyMessage = async (): Promise<void> => {
    await navigator.clipboard.writeText(await fetchMessage(commit.hash))
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => navigator.clipboard.writeText(commit.hash)}>
          <Copy />
          Copy SHA
        </ContextMenuItem>
        <ContextMenuItem onClick={copyMessage}>
          <MessageSquare />
          Copy commit message
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function HistoryList(): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const commits = useGitLog(200)

  if (commits === undefined) {
    return <p className="p-3 text-sm text-muted-foreground">Loading…</p>
  }

  if (commits.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground">No commits yet.</p>
  }

  return (
    <SidebarMenu>
      {commits.map((commit) => (
        <SidebarMenuItem key={commit.hash}>
          <CommitContextMenu commit={commit}>
            <SidebarMenuButton
              className="h-auto py-1 text-[13px]"
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
          </CommitContextMenu>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
