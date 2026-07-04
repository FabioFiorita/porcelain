import { SidebarMenu } from '@renderer/components/ui/sidebar'
import { useReadDir } from '@renderer/hooks/use-files'
import { useTreeDirsStore } from '@renderer/stores/tree-dirs'
import { useEffect } from 'react'
import { TreeNode } from './tree-node'

export function FileTree({ rootPath }: { rootPath: string }): React.JSX.Element {
  const entries = useReadDir(rootPath)
  // Watch the repo root the same way each expanded `DirNode` watches itself, so an
  // add/remove at the top level (not inside an expanded subfolder) refreshes too.
  const addWatchedDir = useTreeDirsStore((s) => s.add)
  const removeWatchedDir = useTreeDirsStore((s) => s.remove)
  useEffect(() => {
    addWatchedDir(rootPath)
    return () => removeWatchedDir(rootPath)
  }, [rootPath, addWatchedDir, removeWatchedDir])

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
