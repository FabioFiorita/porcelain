import { View } from 'react-native'

import { PhoneBottomChrome } from './bottom-chrome'
import { HubSidebar } from './hub-sidebar'
import { PhoneShell } from './phone-shell'
import { HUB_SIDEBAR_WIDTH } from './shell-layout'
import { useShellLayout } from './use-app-window'

/**
 * The tablet shell: the same four tabs, with the Hub list held beside the screen it opened
 * instead of under it.
 *
 * This is the web client's shape — sidebar next to viewer — reached the only way an iPad-width
 * window makes it worth reaching: once you are INSIDE a Worktree. At the Hub list itself the
 * list is the screen, so there is one column; push a Worktree, a surface, or a file and the list
 * slides out beside it rather than being covered. `decideShellLayout` owns that rule.
 *
 * **The tabs are never remounted.** `PhoneShell` sits in a fixed child slot with the sidebar
 * conditional beside it, so widening and narrowing the window — Stage Manager, Split View, a
 * rotation — adds and removes one column while every tab's native stack, and whatever is pushed
 * on it, stays exactly where it was. That is the whole answer to a live resize: the routed
 * screen never moves between containers, because it was never in the sidebar's container.
 *
 * **Why this is a flex row and not `UISplitViewController`.** expo-router 57 does ship the
 * platform primitive (`expo-router/unstable-split-view`, over `react-native-screens`'
 * experimental `Split.Host`), and it is the right thing when the app's ROOT is a split. It
 * cannot be this: `SplitView` throws inside any navigator, so it can only replace the tab shell
 * rather than live in the Worktrees tab — an iPad app with no tabs, whose `Slot` unmounts the
 * other tabs' stacks. `Split.Host` underneath it renders `null` on Android outright. A two-column
 * flex layout keeps all four tabs, keeps every stack mounted, and works on both tablets. The
 * swap back to the native split stays a change to this one file if a no-tabs iPad is ever what
 * is wanted.
 */
export function TabletShell(): React.JSX.Element {
  const layout = useShellLayout()

  return (
    <View className="flex-1 flex-row bg-background">
      {layout === 'split' ? (
        <View
          /* nativewind-allow-style: the column's width is half of the threshold that decides
             whether it appears at all, so both live on the same constant. */
          style={{ width: HUB_SIDEBAR_WIDTH }}
        >
          <HubSidebar />
        </View>
      ) : null}
      {/* Fixed slot: this subtree must keep its identity across every layout change. */}
      <View className="min-w-0 flex-1">
        <PhoneBottomChrome>
          <PhoneShell />
        </PhoneBottomChrome>
      </View>
    </View>
  )
}
