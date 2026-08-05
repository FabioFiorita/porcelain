import { View } from 'react-native'

import { EmptyNote } from '@/components/panel-chrome'
import { useFilesStore } from '@/features/files/files-store'
import { useShellStore } from '@/features/shell/shell-store'
import { useChangesStore } from './changes-store'
import { DiffView } from './diff-view'
import { ReadAllView } from './read-all-view'
import { useChangesFlow } from './use-changes'

/**
 * The tablet's viewer column: whatever the list last selected — one file's diff, or the whole
 * set as a continuous read.
 *
 * Tablet-only. This column is always on screen beside the list, so it has no back affordance
 * and no tab-bar inset to clear; the phone reaches the same two views through pushed routes
 * that pass their own chrome insets.
 */
export function ChangesViewer({ active }: { active: boolean }): React.JSX.Element {
  const scope = useChangesStore((state) => state.scope)
  const selection = useChangesStore((state) => state.selection)
  // The base ref is part of what identifies a branch-scope diff, and it comes from the same
  // read the list renders — already cached, so this costs nothing.
  const { base } = useChangesFlow(active)

  if (selection === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <EmptyNote
          body="Pick a file to read its diff, or open the whole set with the read-all button."
          testID="porcelain-changes-viewer-empty"
          title="No file open"
        />
      </View>
    )
  }
  if (selection.kind === 'all') {
    return <ReadAllView active={active} base={base} scope={scope} />
  }
  return (
    <DiffView
      active={active}
      base={base}
      filePath={selection.path}
      // Tablet: the file opens in the Files destination's viewer column, so the rail moves
      // with it — the alternative is a viewer showing a file the rail says you are not on.
      onOpenFile={(path) => {
        useFilesStore.getState().openFile(path)
        useShellStore.getState().setActiveSurface('files')
      }}
    />
  )
}
