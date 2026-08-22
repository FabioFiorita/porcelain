import * as DialogPrimitive from '@rn-primitives/dialog'
import { KeyboardAvoidingView, Platform, Pressable, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

/** The 8pt breathing room under the body's last row, before the home-indicator inset. */
const BODY_TRAILING_GAP = 8

/** How much of the window height a sheet may grow to before its body has to scroll instead. */
const MAX_HEIGHT_FRACTION = 0.85

/**
 * Fill the parent, as a literal.
 *
 * Not `StyleSheet.absoluteFill`: that is a registered style — an opaque handle rather than an
 * object — and `react-native-css` drops it when merging an inline style with a class-derived
 * one. The backdrop then laid out in normal flow, which is a dialog with no dimming behind it.
 */
const FILL = { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 } as const

/**
 * The dimmed backdrop, as an inline colour.
 *
 * `bg-black/50` on the same element does not paint. The element is `Overlay`'s slotted child,
 * and a slot merges the primitive's props over ours — the class survives as a prop while the
 * style the primitive supplies wins the `backgroundColor` slot. Spelling the colour inline puts
 * it on the side of the merge that lands. It is the one value in this file that is not a token,
 * and it has no token to be: `--background` is the app's paper, not the scrim over it.
 */
const SCRIM = { ...FILL, backgroundColor: 'rgba(0, 0, 0, 0.5)' } as const

/**
 * A sheet that belongs to a component: a row's action list, a rename field, a token picker.
 *
 * Built on `@rn-primitives/dialog` — the React Native Reusables primitive the rest of this
 * client's `components/ui` comes from — rather than `@expo/ui`'s `BottomSheet`. That was a
 * SwiftUI sheet on iOS and a Material 3 `ModalBottomSheet` on Android, hosting our views inside
 * a container drawn by the platform: its own fill, its own corner radius, its own grabber, its
 * own backdrop. Our content sat in the middle of it looking borrowed, which is the same seam
 * the tab bar and the navigation bar had. Every pixel here is a token instead, so a sheet looks
 * like the card it rose out of.
 *
 * What the platform sheet gave us and this has to draw: the grabber, the dimmed backdrop that
 * dismisses on press (`Overlay`), and keyboard avoidance for the sheets that hold a field. It
 * does NOT reimplement detents — a sheet that belongs to a control is as tall as its content,
 * capped so a long list can never cover the screen it was opened from.
 *
 * **Every class in here is on a view authored in THIS file, and that is not a style choice.**
 * `className` is compiled by a JSX transform that runs over our source; a class handed to a
 * component from `node_modules` — or to a reanimated view — arrives as an ordinary prop that
 * nothing ever reads. A first cut animated the backdrop with `Animated.View` and styled the
 * primitives by passing them `className`, and produced a transparent sheet over an undimmed
 * screen with the geometry perfectly correct: the inline styles applied and not one of the
 * classes did. Hence `asChild` on both primitives — it makes them render OUR element — and
 * plain views rather than animated ones. When this earns a transition, the animated view wraps
 * a classed one rather than wearing the classes itself.
 *
 * Sheets that are a DESTINATION rather than a control — quick open, the surface companion, the
 * composers — stay `formSheet` routes (see `app/(hub)/_layout.tsx`). Those are presented by the
 * navigator, and their bar is `SheetBar`.
 */
export function Sheet({
  children,
  description,
  onClose,
  open,
  scrollable = false,
  testID,
  title,
}: {
  children: React.ReactNode
  description?: string
  onClose: () => void
  open: boolean
  /**
   * The body scrolls, so it has no intrinsic height to measure — give it the full cap instead
   * of letting it collapse to nothing.
   */
  scrollable?: boolean
  testID?: string
  title?: string
}): React.JSX.Element {
  const insets = useSafeAreaInsets()
  // `max-h-[85%]` resolves against Yoga's own content box, not the window, whenever nothing in
  // the ancestor chain up to the absolute-filled backdrop carries a DEFINITE height — every
  // intervening `justify-end` box here is auto-sized. That makes the cap shrink toward whatever
  // fraction of the CONTENT's own natural size it last measured rather than 85% of the screen: a
  // short sheet (one field, one button row) usually lands under the true cap anyway and looks
  // fine; a taller one (several list rows) hits it and the box clips its last rows off, which is
  // exactly what a bottom-anchored sheet with a rounded top must never do. A pixel cap computed
  // from the window has no such ambiguity to resolve.
  const maxHeight = useWindowDimensions().height * MAX_HEIGHT_FRACTION

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        {/* The backdrop. `asChild` so the class list below is ours and actually applies; `FILL`
            because `PortalHost` renders a fragment, so this has to be told to fill rather than
            sit at `top: 0` of whatever box contains the host. Pressing it dismisses — that
            handler comes from the primitive. */}
        <DialogPrimitive.Overlay asChild>
          <Pressable
            className="justify-end"
            /* nativewind-allow-style: see `SCRIM`. */
            style={SCRIM}
            testID={testID === undefined ? undefined : `${testID}-backdrop`}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              className="justify-end"
              /* nativewind-allow-style: see the note on `maxHeight` above. */
              style={scrollable ? { flex: 1, maxHeight } : undefined}
            >
              <DialogPrimitive.Content asChild>
                <View
                  className={cn(
                    'rounded-t-2xl border-t border-border bg-card',
                    scrollable && 'flex-1',
                  )}
                  // The sheet is inside the backdrop's `Pressable`, so a tap on its own blank
                  // space would otherwise dismiss it. Claiming the responder keeps the press.
                  onStartShouldSetResponder={() => true}
                  /* nativewind-allow-style: see the note on `maxHeight` above. */
                  style={scrollable ? undefined : { maxHeight }}
                  testID={testID}
                >
                  {/* The grabber. Decoration, not a control — the dismissal it advertises is
                      the backdrop press, which `Overlay` already owns. */}
                  <View className="items-center py-2">
                    <View className="h-1 w-9 rounded-full bg-muted-foreground/40" />
                  </View>
                  {title === undefined ? null : (
                    <View className="gap-1 px-5 pb-3">
                      <Text className="text-base font-semibold text-foreground">{title}</Text>
                      {description === undefined ? null : (
                        <Text className="text-sm text-muted-foreground">{description}</Text>
                      )}
                    </View>
                  )}
                  {/* `paddingBottom` here, not on a trailing sibling after `children`: a plain
                      View placed after this one — sized only by its own `height` or
                      `paddingBottom` style, with nothing else in it — measures correctly in
                      Yoga but the card's rounded/bordered background does not extend down to
                      include it, leaving it rendering as a disconnected strip below the card
                      instead of inside it. Putting the inset on the LAST view that already
                      holds real content sidesteps whatever that rendering gap is. */}
                  <View
                    className={cn('gap-3', scrollable && 'min-h-0 flex-1')}
                    style={{
                      paddingBottom: BODY_TRAILING_GAP + (insets.bottom === 0 ? 16 : insets.bottom),
                    }}
                  >
                    {children}
                  </View>
                </View>
              </DialogPrimitive.Content>
            </KeyboardAvoidingView>
          </Pressable>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
