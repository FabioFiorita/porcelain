import { View } from 'react-native'

import { useSurfaceOpen } from '@/features/shell/use-surface-open'

import { ChangesList } from './changes-list'

/**
 * The Changes surface on phone: the list, under the header `SurfaceScreen` draws.
 *
 * Opening a file pushes a route onto this tab's stack rather than swapping a viewer in behind a
 * store flag, so the interactive pop gesture, the Android hardware back button, and
 * re-tap-to-root all come from the navigator. The tablet's Surfaces panel pushes the same
 * routes — see `changes-surface-panel.tsx` — so both form factors reach a diff the same way.
 */
export function ChangesPhoneScreen({ active }: { active: boolean }): React.JSX.Element {
  const open = useSurfaceOpen()

  return (
    <View className="flex-1" testID="porcelain-phone-surface-changes">
      <ChangesList active={active} onOpenAll={open.changesReadAll} onOpenFile={open.changesFile} />
    </View>
  )
}
