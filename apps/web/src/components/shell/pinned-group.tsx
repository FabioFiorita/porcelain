import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@renderer/components/ui/empty'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@renderer/components/ui/sidebar'
import { usePinnedFiles } from '@renderer/features/files'
import { Pin } from 'lucide-react'
import { TreeNode } from './tree-node'

export function PinnedGroup({ compact = false }: { compact?: boolean }): React.JSX.Element {
  const { entries, error, isLoading } = usePinnedFiles()
  const groupClass = compact ? 'px-2 pt-2' : 'flex h-full flex-col px-3 pt-3'
  const labelClass = 'h-6 px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground'

  // Empty: the label still orients the panel; a centered treatment (short line + the
  // existing hint) sits below it so the panel doesn't read as an orphan header over a
  // void — the rest of the file-tree content then sits below it naturally.
  if (isLoading || error !== null || entries === undefined || entries.length === 0) {
    return (
      <SidebarGroup className={groupClass}>
        <SidebarGroupLabel className={labelClass}>Pinned</SidebarGroupLabel>
        <Empty
          className={
            compact
              ? 'min-h-28 border-none bg-muted/20 px-4 py-6'
              : 'mx-1 min-h-36 flex-1 border-none bg-muted/20 px-4 py-8'
          }
        >
          <EmptyMedia>
            <Pin />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>
              {isLoading
                ? 'Loading pinned files…'
                : error === null
                  ? 'No pinned files'
                  : 'Pinned files unavailable'}
            </EmptyTitle>
            <EmptyDescription>
              {error === null
                ? 'Right-click a file or folder in the tree to pin it here.'
                : error.message}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup className={compact ? 'px-2 py-2' : 'px-3 pt-3'}>
      <SidebarGroupLabel className={labelClass}>Pinned</SidebarGroupLabel>
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
