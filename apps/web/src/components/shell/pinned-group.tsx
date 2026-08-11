import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@renderer/components/ui/sidebar'
import { usePinnedFiles } from '@renderer/features/files'
import { TreeNode } from './tree-node'

export function PinnedGroup(): React.JSX.Element {
  const entries = usePinnedFiles()

  // Empty: the label still orients the panel; a centered treatment (short line + the
  // existing hint) sits below it so the panel doesn't read as an orphan header over a
  // void — the Notes card then sits below it naturally.
  if (entries === undefined || entries.length === 0) {
    return (
      <SidebarGroup className="flex h-full flex-col px-3 pt-3">
        <SidebarGroupLabel className="h-6 px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Pinned
        </SidebarGroupLabel>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-52 text-center">
            <p className="text-xs font-medium text-foreground">No pinned files</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Right-click a file or folder in the tree to pin it here.
            </p>
          </div>
        </div>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup className="px-3 pt-3">
      <SidebarGroupLabel className="h-6 px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Pinned
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {entries.map((entry) => (
            <TreeNode key={entry.path} entry={entry} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
