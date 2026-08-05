import { View } from 'react-native'

import { EmptyNote } from '@/components/panel-chrome'

import { FileViewer } from './file-viewer'
import { useFilesStore } from './files-store'

/**
 * The tablet's viewer column: whatever the tree or the search results last selected.
 *
 * Tablet-only. The phone reaches the same viewer through a pushed route that passes its own
 * chrome insets and a back handler; this column is always on screen beside the list, so it
 * needs neither.
 */
export function FilesViewer({ active }: { active: boolean }): React.JSX.Element {
  const selection = useFilesStore((state) => state.selection)

  if (selection === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <EmptyNote
          body="Pick a file in the tree to read it, or search for one by name."
          testID="porcelain-files-viewer-none"
          title="No file open"
        />
      </View>
    )
  }
  return <FileViewer active={active} filePath={selection} />
}
