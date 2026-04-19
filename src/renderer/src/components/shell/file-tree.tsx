import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@renderer/components/ui/collapsible'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from '@renderer/components/ui/sidebar'
import { trpc } from '@renderer/lib/trpc'
import { useTabsStore } from '@renderer/stores/tabs'
import { ChevronRight, File, Folder } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DirEntry } from '../../../../main/api'

function TreeNode({ entry }: { entry: DirEntry }): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)

  if (entry.kind === 'file') {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={() =>
            openTab({ id: entry.path, kind: 'file', title: entry.name, path: entry.path })
          }
        >
          <File className="text-muted-foreground" />
          <span className="truncate">{entry.name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return <DirNode entry={entry} />
}

function DirNode({ entry }: { entry: DirEntry }): React.JSX.Element {
  const [children, setChildren] = useState<DirEntry[] | null>(null)

  const load = async (): Promise<void> => {
    if (children === null) setChildren(await trpc.readDir.query(entry.path))
  }

  return (
    <SidebarMenuItem>
      <Collapsible className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90">
        <CollapsibleTrigger
          render={
            <SidebarMenuButton onClick={load}>
              <ChevronRight className="transition-transform" />
              <Folder className="text-muted-foreground" />
              <span className="truncate">{entry.name}</span>
            </SidebarMenuButton>
          }
        />
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
  const [entries, setEntries] = useState<DirEntry[] | null>(null)

  useEffect(() => {
    setEntries(null)
    trpc.readDir.query(rootPath).then(setEntries)
  }, [rootPath])

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
