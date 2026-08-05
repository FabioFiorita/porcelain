import { useIsFocused, useRouter } from 'expo-router'
import { View } from 'react-native'

import { PhoneHeader } from '@/features/shell/phone-header'
import { useTabBarInset } from '@/features/shell/tab-bar-inset'

import { HistoryList } from './history-list'

/**
 * The History face of the Changes tab on phone: the header and the commit list.
 *
 * Opening a commit pushes a route onto the Changes tab's stack — History has no tab of its
 * own, it is that tab's alternate face, so its detail screens live in that tab's navigator and
 * inherit its pop gesture and hardware back button.
 *
 * Deliberately does NOT report itself into the history store. The bolt that opens the
 * companion lives on this header and nowhere else — the pushed detail screens carry their own
 * chrome — so if the list reset the store on focus, the companion would be reachable only at
 * the one moment it has nothing to say. Popping back to the list keeps the commit you were
 * reading, which is also what marks its row.
 */
export function HistoryPhoneScreen(): React.JSX.Element {
  const focused = useIsFocused()
  const router = useRouter()
  const bottomInset = useTabBarInset()

  return (
    <View className="flex-1 bg-background" testID="porcelain-phone-surface-history">
      <PhoneHeader companionSurface="history" title="History" />
      <HistoryList
        active={focused}
        bottomInset={bottomInset}
        onOpenCommit={(hash) => {
          router.push({ params: { hash }, pathname: '/changes/commit/[hash]' })
        }}
      />
    </View>
  )
}
