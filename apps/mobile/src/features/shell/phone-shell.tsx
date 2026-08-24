import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DESTINATIONS } from './destinations'

/**
 * The phone shell: the Hub stack fills the window. There is no bottom bar.
 *
 * Worktrees is the Hub — every Worktree of every Environment in one list — and a surface is
 * reached THROUGH the Worktree that owns it, inside that tab's stack.
 *
 * **The navigator is still `expo-router/ui` `Tabs`.** The tablet already hid its `TabList` and
 * switched tabs from the sidebar; the phone now hides the same list. `TabSlot` keeps every
 * visited tab mounted (`activityState: 0`, `display: none`) rather than unmounting it, so a
 * Settings visit does not tear the Hub stack down. A tab mounts lazily on its first visit and
 * is never torn down after.
 *
 * The home indicator used to sit inside the tab bar. With the bar gone, the slot itself clears
 * it so Hub rows are not drawn under the gesture inset.
 */
export function PhoneShell(): React.JSX.Element {
  const insets = useSafeAreaInsets()

  return (
    <Tabs>
      <View
        className="flex-1 bg-background"
        /* nativewind-allow-style: the home indicator is owned HERE now that there is no tab bar. */
        style={{ paddingBottom: insets.bottom }}
      >
        <TabSlot />
      </View>
      <TabList style={{ display: 'none' }}>
        {DESTINATIONS.map((destination) => (
          <TabTrigger key={destination.name} href={destination.href} name={destination.name} />
        ))}
      </TabList>
    </Tabs>
  )
}
