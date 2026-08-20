import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChromeGlyph } from '@/components/chrome-glyph'
import { SURFACE_HEADER_BAND } from '@/components/surface-layout'
import { cn } from '@/lib/utils'
import { useShellStore } from './shell-store'
import type { SurfaceId } from './surfaces'

type PhoneHeaderProps = {
  /** Large title — active face name (Files, Search, Changes, …). */
  title: string
  /**
   * Surface the bolt companion should open for. Defaults to store activeSurface
   * when omitted (settings tab has no product surface).
   */
  companionSurface?: SurfaceId
  /**
   * Back chevron when this screen was pushed. A TAB ROOT passes false: the Hub stack has
   * history behind the tab you are on, so `canGoBack()` is true there too, and a chevron on a
   * tab root would pop a stack the reader is not looking at.
   */
  back?: boolean
  /** Quick-open button. The Hub list drops it — it is a Worktree list, not a search. */
  search?: boolean
  /**
   * Companion bolt. Product tabs keep it; Settings drops it — prefs have no
   * companion rail content.
   */
  companion?: boolean
  /**
   * Bottom border under the title band. Settings puts the border under its
   * section tabs instead so the tabs read as part of the header; the band it
   * passes as `children` owns the divider in that case.
   */
  border?: boolean
  /** Optional content under the title row (Settings section tabs). */
  children?: React.ReactNode
}

/**
 * Phone title bar:
 *   [ ‹  Title                                🔍 ⚡ ]
 *
 * The chevron appears whenever this screen was pushed — which, now that surfaces live inside
 * the Hub stack, is every screen except the four tab roots. The native bar is hidden (each
 * screen carries chrome it has no room for), so without this the only way back is the edge
 * swipe, and a hierarchy with no visible way up is a hierarchy people get lost in.
 *
 * The project / branch / worktree chip row is gone with the shell that needed it. A surface is
 * now reached THROUGH a Worktree — the Hub list picks the checkout, and the screen you are on
 * cannot be showing a different one — so a switcher in the header would be a second, competing
 * answer to a question the navigation already settled.
 */
export function PhoneHeader({
  title,
  companionSurface,
  back = true,
  search = true,
  companion = true,
  border = true,
  children,
}: PhoneHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const canGoBack = back && router.canGoBack()
  const openSheet = useShellStore((state) => state.openSheet)
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)

  return (
    <View
      className={cn('bg-background', border && 'border-b border-border')}
      /* nativewind-allow-style: the band clears the live status-bar inset. */
      style={{ paddingTop: Math.max(insets.top, 8) + 4 }}
      testID="porcelain-phone-header"
    >
      <View className={SURFACE_HEADER_BAND}>
        <View className="min-h-11 flex-row items-center justify-between gap-3">
          {canGoBack ? (
            <Pressable
              accessibilityLabel="Back"
              accessibilityRole="button"
              className="-ml-1 shrink-0 py-1 pr-1"
              testID="porcelain-phone-back"
              onPress={() => {
                router.back()
              }}
            >
              <ChromeGlyph name="chevronLeft" size={22} tone="foreground" />
            </Pressable>
          ) : null}
          <Text
            accessibilityRole="header"
            className="min-w-0 flex-1 text-[28px] font-extrabold tracking-tight text-foreground"
            numberOfLines={1}
            testID="porcelain-phone-title"
          >
            {title}
          </Text>

          {companion || search ? (
            <View className="shrink-0 flex-row items-center gap-2">
              {search ? (
                <Pressable
                  accessibilityLabel="Quick open"
                  accessibilityRole="button"
                  /* panel-card-allow: a 40pt control, not a card. */
                  className="size-10 items-center justify-center rounded-xl border border-border bg-card active:bg-accent"
                  testID="porcelain-phone-search"
                  onPress={() => {
                    openSheet('search')
                  }}
                >
                  <ChromeGlyph name="search" size={17} tone="foreground" />
                </Pressable>
              ) : null}
              {companion ? (
                <Pressable
                  accessibilityLabel="Companion"
                  accessibilityRole="button"
                  /* panel-card-allow: a 40pt control, not a card. */
                  className="size-10 items-center justify-center rounded-xl border border-border bg-card active:bg-accent"
                  testID="porcelain-phone-bolt"
                  onPress={() => {
                    if (companionSurface !== undefined) {
                      setActiveSurface(companionSurface)
                    }
                    openSheet('companion')
                  }}
                >
                  <ChromeGlyph name="companion" size={17} tone="foreground" />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  )
}
