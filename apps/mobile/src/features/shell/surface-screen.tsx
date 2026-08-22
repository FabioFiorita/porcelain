import { useIsFocused, useRouter } from 'expo-router'
import { View } from 'react-native'

import { ScreenHeader } from '@/components/panel-chrome'

import { HeaderActions } from './header-actions'
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
 * The header is drawn HERE, once, for **all six** surfaces. It was four sets of `title` /
 * `headerRight` options on the stack layout plus two screens (Git, Canvas) that drew their own
 * bar in their own file — which is how Git's back chevron and Files' back chevron ended up
 * being two different components. The companion bolt appears only for a surface that has a
 * companion sheet, which `surfaceSlots` already knows.
 *
 * `ColumnChrome` wraps the body because this screen has now drawn the top chrome. Files' own
 * breadcrumb band doubles as a header on the routes it owns and reads the same shell value to
 * decide; without this it would draw a second bar under the first.
 *
 * **Nothing is reported to the shell store from here.** It used to write `activeSurface` on
 * focus, back when the tablet's trailing panel was a companion that followed whatever screen
 * was in the viewer. That panel is the Surfaces strip now and owns its own tab; a screen
 * writing into it would silently re-open a surface the human had just closed.
 */
export function SurfaceScreen({ surface }: { surface: SurfaceId }): React.JSX.Element {
  const focused = useIsFocused()
  const router = useRouter()
  const slots = surfaceSlots(surface)
  const Body = slots.phone

  return (
    <View className="flex-1 bg-background" testID={`porcelain-${surface}-screen`}>
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
        <Body active={focused} />
      </ColumnChrome>
    </View>
  )
}
