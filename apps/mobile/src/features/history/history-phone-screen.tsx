import { View } from 'react-native'

import { useSurfaceOpen } from '@/features/shell/use-surface-open'

import { HistoryList } from './history-list'

/**
 * The History surface on phone: the commit list, under the header `SurfaceScreen` draws.
 *
 * Opening a commit pushes onto the Hub stack, so it inherits the pop gesture and the hardware
 * back button.
 *
 * Deliberately does NOT report itself into the history store. The bolt that opens the companion
 * lives on this header and nowhere else — the pushed detail screens carry their own chrome — so
 * if the list reset the store on focus, the companion would be reachable only at the one moment
 * it has nothing to say. Popping back to the list keeps the commit you were reading, which is
 * also what marks its row.
 */
export function HistoryPhoneScreen({ active }: { active: boolean }): React.JSX.Element {
  const open = useSurfaceOpen()

  return (
    <View className="flex-1" testID="porcelain-phone-surface-history">
      <HistoryList active={active} onOpenCommit={open.commit} />
    </View>
  )
}
