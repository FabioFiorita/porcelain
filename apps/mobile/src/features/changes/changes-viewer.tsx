import { View } from 'react-native'

import { EmptyNote } from './changes-chrome'
import { useChangesStore } from './changes-store'
import { DiffView } from './diff-view'
import { ReadAllView } from './read-all-view'
import { useChangesFlow } from './use-changes'

/**
 * The Changes viewer: whatever the list last opened — one file's diff, or the whole set as a
 * continuous read. `onBack` is passed on phone, where the viewer replaces the list; the
 * tablet keeps both on screen and omits it.
 */
export function ChangesViewer({
  active,
  bottomInset = 0,
  onBack,
  topInset = 0,
}: {
  active: boolean
  /** Phone: room for the floating tab bar the rows scroll under. */
  bottomInset?: number
  onBack?: () => void
  /** Phone: the detail replaces the tab header, so it owns the status-bar inset. */
  topInset?: number
}): React.JSX.Element {
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
    return (
      <ReadAllView
        active={active}
        base={base}
        bottomInset={bottomInset}
        scope={scope}
        topInset={topInset}
        onBack={onBack}
      />
    )
  }
  return (
    <DiffView
      active={active}
      base={base}
      bottomInset={bottomInset}
      filePath={selection.path}
      topInset={topInset}
      onBack={onBack}
    />
  )
}
