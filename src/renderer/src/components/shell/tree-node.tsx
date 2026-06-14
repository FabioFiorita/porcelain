import type { DirEntry } from '@main/api'
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
import { SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from '@renderer/components/ui/sidebar'
import { FileTypeIcon, FolderIcon } from '@renderer/components/viewer/file-icon'
import { useEntryActions, useReadDir, useReadFilePrefetch } from '@renderer/hooks/use-files'
import { cn } from '@renderer/lib/utils'
import { useSelectionStore } from '@renderer/stores/selection'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'

function EntryContextMenu({
  entry,
  children,
}: {
  entry: DirEntry
  children: React.ReactNode
}): React.JSX.Element {
  const { hide, unhide, hideSelected, pin, unpin, selectionSize } = useEntryActions(entry)
  const batchSize = selectionSize + (useSelectionStore.getState().selected.has(entry.path) ? 0 : 1)
  const openTabToSide = useTabsStore((s) => s.openTabToSide)

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {entry.kind === 'file' && (
          <ContextMenuItem
            onClick={() =>
              openTabToSide({
                id: tabId('file', entry.path),
                kind: 'file',
                title: entry.name,
                path: entry.path,
              })
            }
          >
            Open to the Side
          </ContextMenuItem>
        )}
        {entry.pinned ? (
          <ContextMenuItem onClick={unpin}>Unpin</ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={pin}>Pin</ContextMenuItem>
        )}
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

export function TreeNode({ entry }: { entry: DirEntry }): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const pinTab = useTabsStore((s) => s.pinTab)
  const isSelected = useSelectionStore((s) => s.selected.has(entry.path))
  const toggleSelection = useSelectionStore((s) => s.toggle)
  const prefetchFile = useReadFilePrefetch()

  if (entry.kind === 'file') {
    return (
      <SidebarMenuItem>
        <EntryContextMenu entry={entry}>
          <SidebarMenuButton
            className={cn(entry.hidden && 'opacity-50', isSelected && 'bg-sidebar-accent')}
            onMouseEnter={() => prefetchFile(entry.path)}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey) {
                toggleSelection(entry.path)
                return
              }
              openTab({
                id: tabId('file', entry.path),
                kind: 'file',
                title: entry.name,
                path: entry.path,
                preview: true,
              })
            }}
            onDoubleClick={() => pinTab(tabId('file', entry.path))}
          >
            <FileTypeIcon name={entry.name} />
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
                <FolderIcon open={expanded} />
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
