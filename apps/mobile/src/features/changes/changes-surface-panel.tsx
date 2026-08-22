import { View } from 'react-native'

import { useSurfaceOpen } from '@/features/shell/use-surface-open'

import { ChangesList } from './changes-list'
import { useChangesStore } from './changes-store'

/**
 * The Changes surface as a tab of the tablet's Surfaces panel.
 *
 * Identical wiring to the phone screen, and that is the point: a row opens the diff into the
 * Hub stack, which is the phone's own screen stack and the tablet's centre viewer. The panel
 * marks the row it opened so the reader can see where they are in a long change set.
 */
export function ChangesSurfacePanel({ active }: { active: boolean }): React.JSX.Element {
  const selectFile = useChangesStore((state) => state.openFile)
  const selectAll = useChangesStore((state) => state.openAll)
  const open = useSurfaceOpen()

  return (
    <View className="flex-1" testID="porcelain-changes-surface-panel">
      <ChangesList
        active={active}
        onOpenAll={() => {
          selectAll()
          open.changesReadAll()
        }}
        onOpenFile={(path) => {
          selectFile(path)
          open.changesFile(path)
        }}
      />
    </View>
  )
}
