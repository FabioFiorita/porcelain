import { View } from 'react-native'

import { useSurfaceOpen } from '@/features/shell/use-surface-open'

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
 * **Folders move the cursor; files open the viewer.** A panel has no stack of its own, so a
 * folder pushed as a route would land the *directory* in the viewer beside the tree that was
 * already showing it. The store cursor walks the tree inside the panel — with the breadcrumb as
 * the way back up — and only a file becomes a push, into the centre column. That is the web
 * client's split exactly: the tree stays in the sidebar, the file goes in the Viewer.
 */
export function FilesSurfacePanel({ active }: { active: boolean }): React.JSX.Element {
  const cursor = useFilesStore((state) => state.cursor)
  const selection = useFilesStore((state) => state.selection)
  const openDir = useFilesStore((state) => state.openDir)
  const select = useFilesStore((state) => state.openFile)
  const open = useSurfaceOpen()

  return (
    <View className="flex-1" testID="porcelain-files-surface-panel">
      <PinnedSection active={active} compact />
      <FilesBrowser
        active={active}
        dirPath={cursor}
        onOpenCrumb={openDir}
        onOpenDir={openDir}
        onOpenFile={(path) => {
          // The row stays marked as the one the viewer holds; the push is what actually opens it.
          select(path)
          open.file(path)
        }}
        selectedPath={selection}
      />
    </View>
  )
}
