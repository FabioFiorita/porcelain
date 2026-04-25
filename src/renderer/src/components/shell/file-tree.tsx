import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@renderer/components/ui/collapsible'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from '@renderer/components/ui/sidebar'
import { trpc } from '@renderer/lib/trpc'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'
import { ChevronRight, File, Folder } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DirEntry } from '../../../../main/api'

function useEntryActions(entry: DirEntry): {
  hide: () => Promise<void>
  unhide: () => Promise<void>
} {
  const repo = useRepoStore((s) => s.repo)
  const refreshTree = useRepoStore((s) => s.refreshTree)

  const run = async (action: 'hidePath' | 'unhidePath'): Promise<void> => {
    if (!repo) return
    await trpc[action].mutate({ repoPath: repo.path, path: entry.path })
    refreshTree()
  }

  return { hide: () => run('hidePath'), unhide: () => run('unhidePath') }
}

function EntryContextMenu({
  entry,
  children,
}: {
  entry: DirEntry
  children: React.ReactNode
}): React.JSX.Element {
  const { hide, unhide } = useEntryActions(entry)

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {entry.hidden ? (
          <ContextMenuItem onClick={unhide}>Unhide</ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={hide}>Hide</ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function useReadDir(path: string, enabled = true): DirEntry[] | null {
  const repo = useRepoStore((s) => s.repo)
  const showHidden = useRepoStore((s) => s.showHidden)
  const treeVersion = useRepoStore((s) => s.treeVersion)
  const [entries, setEntries] = useState<DirEntry[] | null>(null)

  useEffect(() => {
    if (!repo || !enabled) return
    let stale = false
    trpc.readDir.query({ repoPath: repo.path, path, showHidden }).then((result) => {
      if (!stale) setEntries(result)
    })
    return () => {
      stale = true
    }
  }, [repo, path, showHidden, treeVersion, enabled])

  return entries
}

function TreeNode({ entry }: { entry: DirEntry }): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const dimmed = entry.hidden && 'opacity-50'

  if (entry.kind === 'file') {
    return (
      <SidebarMenuItem>
        <EntryContextMenu entry={entry}>
          <SidebarMenuButton
            className={cn(dimmed)}
            onClick={() =>
              openTab({ id: entry.path, kind: 'file', title: entry.name, path: entry.path })
            }
          >
            <File className="text-muted-foreground" />
            <span className="truncate">{entry.name}</span>
          </SidebarMenuButton>
        </EntryContextMenu>
      </SidebarMenuItem>
    )
  }

  return <DirNode entry={entry} />
}

function DirNode({ entry }: { entry: DirEntry }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const children = useReadDir(entry.path, expanded)

  return (
    <SidebarMenuItem>
      <Collapsible
        className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
        onOpenChange={setExpanded}
      >
        <EntryContextMenu entry={entry}>
          <CollapsibleTrigger
            render={
              <SidebarMenuButton className={cn(entry.hidden && 'opacity-50')}>
                <ChevronRight className="transition-transform" />
                <Folder className="text-muted-foreground" />
                <span className="truncate">{entry.name}</span>
              </SidebarMenuButton>
            }
          />
        </EntryContextMenu>
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 pr-0">
            {children?.map((child) => (
              <TreeNode key={child.path} entry={child} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  )
}

export function FileTree({ rootPath }: { rootPath: string }): React.JSX.Element {
  const entries = useReadDir(rootPath)

  if (entries === null) {
    return <p className="p-3 text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <SidebarMenu>
      {entries.map((entry) => (
        <TreeNode key={entry.path} entry={entry} />
      ))}
    </SidebarMenu>
  )
}
