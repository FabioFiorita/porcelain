import { View } from 'react-native'

import { useSurfaceOpen } from '@/features/shell/use-surface-open'
import { REPO_ROOT } from './file-paths'
import { FilesBrowser } from './files-browser'
import { PinnedSection } from './files-companion'
import { useFilesStore } from './files-store'

/**
 * The Files surface as a tab of the tablet's Surfaces panel.
 *
 * The web client's `FilesSurface` stacks the project's pins above the tree in ONE sidebar panel
 * rather than putting them in a companion of their own, and this is that panel. The pins are
 * `shrink-0` above a scrolling tree, and they draw nothing at all until the project has some.
 *
 * Folders expand lazily in this persistent rail; files open in the centre viewer. The tree stays
 * in place while the selected file changes, matching the web client's split.
 */
export function FilesSurfacePanel({ active }: { active: boolean }): React.JSX.Element {
  const selection = useFilesStore((state) => state.selection)
  const select = useFilesStore((state) => state.openFile)
  const open = useSurfaceOpen()

  return (
    <View className="flex-1" testID="porcelain-files-surface-panel">
      <PinnedSection active={active} compact />
      <FilesBrowser
        active={active}
        dirPath={REPO_ROOT}
        onOpenDir={() => {}}
        onOpenFile={(path) => {
          // The row stays marked as the one the viewer holds; the push is what actually opens it.
          select(path)
          open.file(path)
        }}
        selectedPath={selection}
        tree
      />
    </View>
  )
}
