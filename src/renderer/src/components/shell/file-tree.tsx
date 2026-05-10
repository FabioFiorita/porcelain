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
import { useSelectionStore } from '@renderer/stores/selection'
import { useTabsStore } from '@renderer/stores/tabs'
import { ChevronRight, File, Folder } from 'lucide-react'
import { useState } from 'react'
import type { DirEntry } from '../../../../main/api'

function useEntryActions(entry: DirEntry): {
  hide: () => Promise<void>
  unhide: () => Promise<void>
  hideSelected: () => Promise<void>
  selectionSize: number
} {
  const repo = useRepoStore((s) => s.repo)
  const selected = useSelectionStore((s) => s.selected)
  const clearSelection = useSelectionStore((s) => s.clear)
  const utils = trpc.useUtils()
  const hideMutation = trpc.hidePath.useMutation()
  const unhideMutation = trpc.unhidePath.useMutation()

  const run = async (mutation: typeof hideMutation, paths: string[]): Promise<void> => {
    if (!repo) return
    for (const path of paths) {
      await mutation.mutateAsync({ repoPath: repo.path, path })
    }
    clearSelection()
    await utils.readDir.invalidate()
  }

  return {
    hide: () => run(hideMutation, [entry.path]),
    unhide: () => run(unhideMutation, [entry.path]),
    hideSelected: () => run(hideMutation, [...new Set([...selected, entry.path])]),
    selectionSize: selected.size,
  }
}

function EntryContextMenu({
  entry,
  children,
}: {
  entry: DirEntry
  children: React.ReactNode
}): React.JSX.Element {
  const { hide, unhide, hideSelected, selectionSize } = useEntryActions(entry)
  const batchSize = selectionSize + (useSelectionStore.getState().selected.has(entry.path) ? 0 : 1)

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {selectionSize > 0 ? (
          <ContextMenuItem onClick={hideSelected}>Hide {batchSize} items</ContextMenuItem>
        ) : entry.hidden ? (
          <ContextMenuItem onClick={unhide}>Unhide</ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={hide}>Hide</ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function useReadDir(path: string, enabled = true): DirEntry[] | undefined {
  const repo = useRepoStore((s) => s.repo)
  const showHidden = useRepoStore((s) => s.showHidden)
  const { data } = trpc.readDir.useQuery(
    { repoPath: repo?.path ?? '', path, showHidden },
    { enabled: enabled && repo !== null },
  )
  return data
}

function TreeNode({ entry }: { entry: DirEntry }): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const isSelected = useSelectionStore((s) => s.selected.has(entry.path))
  const toggleSelection = useSelectionStore((s) => s.toggle)
  const utils = trpc.useUtils()

  if (entry.kind === 'file') {
    return (
      <SidebarMenuItem>
        <EntryContextMenu entry={entry}>
          <SidebarMenuButton
            className={cn(entry.hidden && 'opacity-50', isSelected && 'bg-sidebar-accent')}
            onMouseEnter={() => void utils.readFile.prefetch(entry.path)}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey) {
                toggleSelection(entry.path)
                return
              }
              openTab({ id: entry.path, kind: 'file', title: entry.name, path: entry.path })
            }}
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
  const isSelected = useSelectionStore((s) => s.selected.has(entry.path))
  const toggleSelection = useSelectionStore((s) => s.toggle)

  return (
    <SidebarMenuItem>
      <Collapsible
        className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
        onOpenChange={setExpanded}
      >
        <EntryContextMenu entry={entry}>
          <CollapsibleTrigger
            render={
              <SidebarMenuButton
                className={cn(entry.hidden && 'opacity-50', isSelected && 'bg-sidebar-accent')}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleSelection(entry.path)
                  }
                }}
              >
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

  if (entries === undefined) {
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
