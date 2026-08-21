import { useIsFocused, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'

import { ScreenHeader } from '@/components/panel-chrome'

import { HeaderActions } from './header-actions'
import { useShellStore } from './shell-store'
import { surfaceSlots } from './surface-slots'
import { type SurfaceId, surfaceById } from './surfaces'
import { ColumnChrome } from './window-chrome'

/**
 * One surface, mounted as a screen inside the Hub stack.
 *
 * A surface used to be a global tab with two faces crammed into it, because five surfaces had
 * to fit four tab slots. It is now reached through the Worktree that owns it, so the slot
 * pressure — and the dual-face store, and the re-tap-to-flip gesture — is gone.
 *
 * The header is drawn HERE, once, for all four surfaces. It was four sets of `title` /
 * `headerRight` options on the stack layout, which put the surface's name and the surface's
 * actions in a different file from the surface — and put them on a `UINavigationBar` that could
 * not be themed. The companion bolt appears only for a surface that has a companion panel, which
 * `surfaceSlots` already knows: Changes has none, on this client or on web.
 *
 * `ColumnChrome` wraps the body because this screen has now drawn the top chrome. Files' own
 * breadcrumb band doubles as a header on the routes it owns and reads the same shell value to
 * decide; without this it would draw a second bar under the first.
 */
export function SurfaceScreen({ surface }: { surface: SurfaceId }): React.JSX.Element {
  const focused = useIsFocused()
  const router = useRouter()
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)
  const slots = surfaceSlots(surface)

  useEffect(() => {
    if (focused) setActiveSurface(surface)
  }, [focused, setActiveSurface, surface])

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        actions={
          <HeaderActions companionSurface={slots.companion === undefined ? undefined : surface} />
        }
        back={{
          accessibilityLabel: 'Back',
          testID: `porcelain-${surface}-back`,
          onPress: () => {
            router.back()
          },
        }}
        testID={`porcelain-${surface}-header`}
        title={surfaceById(surface).label}
      />
      <ColumnChrome>
        <slots.phone />
      </ColumnChrome>
    </View>
  )
}
