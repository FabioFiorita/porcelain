import { Button } from '@renderer/components/ui/button'
import { SidebarMenu } from '@renderer/components/ui/sidebar'
import { useFilesTree } from '@renderer/features/files'
import { useFilePromptStore } from '@renderer/stores/file-prompt'
import { useTreeDirsStore } from '@renderer/stores/tree-dirs'
import { useEffect } from 'react'
import { TreeNode } from './tree-node'

export function FileTree({ rootPath }: { rootPath: string }): React.JSX.Element {
  const newFile = useFilePromptStore((s) => s.newFile)
  const newFolder = useFilePromptStore((s) => s.newFolder)
  const { entries, error, isLoading } = useFilesTree(rootPath)
  // Watch the project root the same way each expanded `DirNode` watches itself, so an
  // add/remove at the top level (not inside an expanded subfolder) refreshes too.
  const addWatchedDir = useTreeDirsStore((s) => s.add)
  const removeWatchedDir = useTreeDirsStore((s) => s.remove)
  useEffect(() => {
    addWatchedDir(rootPath)
    return () => removeWatchedDir(rootPath)
  }, [rootPath, addWatchedDir, removeWatchedDir])

  if (isLoading) {
    return <p className="p-3 text-sm text-muted-foreground">Loading…</p>
  }

  if (error !== null) {
    return <p className="p-3 text-sm text-destructive">Could not read files: {error.message}</p>
  }

  if (entries === undefined || entries.length === 0) {
    return (
      <div className="p-3 text-sm text-muted-foreground">
        <p>This folder is empty.</p>
        <div className="mt-2 flex flex-wrap gap-1">
          <Button variant="outline" size="sm" onClick={() => newFile(rootPath)}>
            New File
          </Button>
          <Button variant="outline" size="sm" onClick={() => newFolder(rootPath)}>
            New Folder
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <SidebarMenu>
        {entries.map((entry) => (
          <TreeNode key={entry.path} entry={entry} />
        ))}
      </SidebarMenu>
    </div>
  )
}
