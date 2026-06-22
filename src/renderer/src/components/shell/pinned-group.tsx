import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@renderer/components/ui/sidebar'
import { usePinnedEntries } from '@renderer/hooks/use-files'
import { TreeNode } from './tree-node'

export function PinnedGroup(): React.JSX.Element {
  const entries = usePinnedEntries()

  return (
    <SidebarGroup className="px-3 pt-3">
      <SidebarGroupLabel className="h-6 px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Pinned
      </SidebarGroupLabel>
      <SidebarGroupContent>
        {entries === undefined || entries.length === 0 ? (
          <p className="px-1 py-1 text-xs text-muted-foreground">
            Right-click a file or folder in the tree to pin it here.
          </p>
        ) : (
          <SidebarMenu>
            {entries.map((entry) => (
              <TreeNode key={entry.path} entry={entry} />
            ))}
          </SidebarMenu>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
