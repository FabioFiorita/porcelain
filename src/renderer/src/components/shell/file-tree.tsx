import { SidebarMenu } from '@renderer/components/ui/sidebar'
import { useReadDir } from '@renderer/hooks/use-files'
import { TreeNode } from './tree-node'

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
