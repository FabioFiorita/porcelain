import { useIsFocused, useRouter } from 'expo-router'
import { View } from 'react-native'

import { PhoneHeader } from '@/features/shell/phone-header'

import { ChangesList } from './changes-list'

/**
 * The Changes tab root on phone: the header and the list.
 *
 * Opening a file pushes a route onto this tab's stack rather than swapping the viewer in
 * behind a store flag, so the interactive pop gesture, the Android hardware back button, and
 * re-tap-to-root all come from the navigator. The tablet keeps the store-driven selection its
 * SplitView column needs — one surface, two navigation models, each native to its form factor.
 */
export function ChangesPhoneScreen(): React.JSX.Element {
  const focused = useIsFocused()
  const router = useRouter()

  return (
    <View className="flex-1 bg-background" testID="porcelain-phone-surface-changes">
      <PhoneHeader companionSurface="changes" title="Changes" />
      <ChangesList
        active={focused}
        onOpenAll={() => {
          router.push('/changes/read-all')
        }}
        onOpenFile={(path) => {
          router.push({ params: { path: path.split('/') }, pathname: '/changes/file/[...path]' })
        }}
      />
    </View>
  )
}
