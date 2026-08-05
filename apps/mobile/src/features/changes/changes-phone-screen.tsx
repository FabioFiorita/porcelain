import { useIsFocused } from 'expo-router'
import { useEffect } from 'react'
import { BackHandler, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PhoneHeader } from '@/features/shell/phone-header'

import { ChangesList } from './changes-list'
import { useChangesStore } from './changes-store'
import { ChangesViewer } from './changes-viewer'

/**
 * The Changes tab on phone: the list, replaced by the viewer once a file is open.
 *
 * Detail is a store swap rather than a router push so the phone and the tablet share one
 * selection model — the tablet's viewer is a SplitView slot the route does not own, and two
 * navigation models for one surface is the fork this codebase exists to avoid. The back
 * affordance and the Android hardware button both clear the selection.
 */
/** Height of the floating native tab bar the scrolling surfaces pass beneath. */
const TAB_BAR_HEIGHT = 52

export function ChangesPhoneScreen(): React.JSX.Element {
  const focused = useIsFocused()
  const insets = useSafeAreaInsets()
  const selection = useChangesStore((state) => state.selection)
  const closeSelection = useChangesStore((state) => state.closeSelection)
  const detail = selection !== null
  // The iOS 26 tab bar floats over the content, so the last rows of a list would sit under it
  // with no way to scroll them clear.
  const tabBarInset = insets.bottom + TAB_BAR_HEIGHT

  useEffect(() => {
    if (!focused || !detail) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSelection()
      return true
    })
    return () => {
      subscription.remove()
    }
  }, [closeSelection, detail, focused])

  return (
    <View className="flex-1 bg-background" testID="porcelain-phone-surface-changes">
      {detail ? (
        <ChangesViewer
          active={focused}
          bottomInset={tabBarInset}
          topInset={Math.max(insets.top, 8)}
          onBack={closeSelection}
        />
      ) : (
        <>
          <PhoneHeader companionSurface="changes" title="Changes" />
          <ChangesList active={focused} bottomInset={tabBarInset} />
        </>
      )}
    </View>
  )
}
