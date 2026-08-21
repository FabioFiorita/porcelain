import type { TabTriggerSlotProps } from 'expo-router/ui'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

/**
 * The phone's bottom navigation, drawn by Porcelain rather than by UIKit.
 *
 * This was `NativeTabs`, and a native tab bar is the one piece of chrome that cannot be made to
 * look like the rest of this product: it is a `UITabBar`, so it brings the system's own fill,
 * its blur, its tint rules, its label type and — from iOS 26 — liquid glass over all of it.
 * Everything above it is painted from `@porcelain/ui` tokens, which is why the seam read as two
 * apps stacked on each other. The web client's navigation is a list of quiet rows that go loud
 * when they are current, and that is what this draws: the same `bg-accent` pill, the same
 * `text-muted-foreground` at rest, the same `border-border` hairline over the same
 * `bg-background`.
 *
 * `expo-router/ui` is what makes it possible without giving up the router: `Tabs` keeps the tab
 * navigator (each tab its own stack, each stack kept mounted when you leave it — see the note in
 * `phone-shell.tsx`), while `TabList` and `TabTrigger` render as ordinary views we style. It is
 * marked experimental upstream; the alternative was a native bar we cannot theme, which is not a
 * trade this product can make.
 *
 * The bar is a real row in the layout, not an overlay. A `UITabBar` floats over its content and
 * UIKit compensates by folding the bar's height into the safe area; a `View` in a column simply
 * ends above it, which is why `bottom-chrome` is gone and every surface's bottom inset is now
 * zero. The bar owns `insets.bottom` itself so the home indicator clears the labels.
 */
export function PorcelainTabBar({ children }: { children: React.ReactNode }): React.JSX.Element {
  const insets = useSafeAreaInsets()

  return (
    <View
      className="flex-row items-stretch gap-1 border-t border-border bg-background px-2 pt-1.5"
      /* nativewind-allow-style: the home indicator overlays the bar's own last row. */
      style={{ paddingBottom: insets.bottom === 0 ? 8 : insets.bottom }}
      testID="porcelain-tab-bar"
    >
      {children}
    </View>
  )
}

export type TabBarItemProps = TabTriggerSlotProps & {
  glyph: ChromeIconName
  label: string
}

/**
 * One destination in the bar.
 *
 * `TabTrigger` hands `isFocused` and its press handlers down to whatever it wraps, so the
 * selected state is the router's and the appearance is ours. The pill is `bg-accent`, the same
 * mark the web sidebar puts behind the row you are standing on.
 */
export function TabBarItem({
  glyph,
  isFocused,
  label,
  style,
  ...props
}: TabBarItemProps): React.JSX.Element {
  return (
    <Pressable
      {...props}
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      className={cn(
        // `will-change-pressable`: the class list gains `active:` only when a tab is NOT
        // focused, and `react-native-css` warns that a pressable state appearing after the
        // first render resets the component and remounts its children. Declaring it up front
        // keeps the bar's items stable across every tab switch.
        'min-h-12 min-w-0 flex-1 items-center justify-center gap-1 rounded-md py-1.5 will-change-pressable',
        isFocused ? 'bg-accent' : 'active:bg-accent/40',
      )}
      /* nativewind-allow-style: `TabTrigger` hands its slot `flexDirection: 'row'` and
         `justifyContent: 'space-between'` — a bar of icons WITH labels beside them — and that
         style arrives inline, where it outranks anything the class list says. The column is
         reasserted here, after the forwarded style, because this is the only place that can. */
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        { flexDirection: 'column', justifyContent: 'center' },
      ]}
      testID={`porcelain-tab-${label.toLowerCase()}`}
    >
      <ChromeGlyph name={glyph} size={18} tone={isFocused === true ? 'foreground' : 'muted'} />
      <Text
        className={cn(
          'text-3xs font-medium',
          isFocused === true ? 'text-accent-foreground' : 'text-muted-foreground',
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  )
}
