import { View } from 'react-native'

import { useFilesStore } from '@/features/files'
import { useSurfaceOpen } from '@/features/shell/use-surface-open'

import { SearchPanel } from './search-panel'

/**
 * The Search surface as a tab of the tablet's Surfaces panel.
 *
 * A hit opens into the viewer the same way a tree row does, and carries the line it matched on,
 * so the file opens where the reader was looking rather than at the top. A folder hit moves the
 * Files cursor instead of pushing — Search and Files share one tree, and landing a directory in
 * the viewer beside the panel that could show it is the trade the Files panel makes for the
 * same reason.
 */
export function SearchSurfacePanel({ active }: { active: boolean }): React.JSX.Element {
  const selection = useFilesStore((state) => state.selection)
  const openDir = useFilesStore((state) => state.openDir)
  const select = useFilesStore((state) => state.openFile)
  const open = useSurfaceOpen()

  return (
    <View className="flex-1" testID="porcelain-search-surface-panel">
      <SearchPanel
        active={active}
        onOpenDir={openDir}
        onOpenFile={(path, line) => {
          select(path, line)
          open.file(path, line)
        }}
        selectedPath={selection}
      />
    </View>
  )
}
