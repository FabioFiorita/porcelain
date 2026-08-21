import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconAction } from '@/components/panel-chrome'

import { DESTINATIONS } from './destinations'
import { useShellStore } from './shell-store'
import { SidebarInspector } from './tablet-inspector'
import { TabletSidebar } from './tablet-sidebar'
import { HUB_SIDEBAR_WIDTH } from './shell-layout'
import { useShellLayout } from './use-app-window'
import { ColumnChrome, ShellControls } from './window-chrome'

/**
 * The tablet shell: the web client's three-pane window, as an app.
 *
 * ```
 *  ┌────────────┬───────────────────────────┬──────────────┐
 *  │ Porcelain  │  ╭─────────────────────╮  │  Companion   │
 *  │ Search     │  │ ScreenHeader        │  │              │
 *  │ Terminals  │  │                     │  │              │
 *  │ Tasks      │  │  the routed stack   │  │              │
 *  │ WORKTREES  │  │                     │  │              │
 *  │  …         │  ╰─────────────────────╯  │              │
 *  │ Settings   │                           │              │
 *  └────────────┴───────────────────────────┴──────────────┘
 * ```
 *
 * This is `app-shell.tsx` from `apps/web`, pane for pane: a navigation sidebar, a rounded
 * `bg-card` viewer with its own header, and a surface panel on the trailing edge. The iPad has
 * been handed phone layouts stretched to 1024pt for years and this product is not going to be
 * another one — the human's words were that it is time to come hard on it.
 *
 * **There is no tab bar here, and the tabs are still what runs it.** `Tabs` stays mounted, its
 * `TabList` is present but hidden, and the sidebar's rows are `TabTrigger`s that address the
 * same tabs by name. So the iPad gets the web silhouette while every stack stays alive behind
 * it: leaving Terminals for Settings and coming back finds the same attached session, and the
 * routed screen never moves between containers when the window resizes, because it was never in
 * the sidebar's container.
 *
 * **Why this is a flex row and not `UISplitViewController`.** expo-router 57 does ship the
 * platform primitive (`expo-router/unstable-split-view`, over `react-native-screens`'
 * experimental `Split.Host`), and it is the right thing when the app's ROOT is a split. It
 * cannot be this: `SplitView` throws inside any navigator, so it can only replace the tab shell
 * rather than live inside it, and `Split.Host` renders `null` on Android outright. It also owns
 * the column headers and does not let them be customised — which is precisely the trade this
 * whole pass reverses. A flex row keeps the navigator, works on both tablets, and every pixel
 * of it is a token.
 *
 * **Narrowing.** An iPad window resizes live — Stage Manager, Split View, a rotation — and the
 * panes drop in the order the web client drops them: the inspector first, then the sidebar,
 * leaving the viewer whole. `decideShellLayout` owns the width rule.
 */
export function TabletShell(): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const layout = useShellLayout()
  // Both panels are open by default and their state is the shell store's, not this component's:
  // the web client opens with its sidebar and its surfaces panel showing, and a panel that has
  // to be found before the window looks like the desktop is a window that does not.
  const sidebarOpen = useShellStore((state) => state.sidebarVisible)
  const toggleSidebar = useShellStore((state) => state.toggleSidebar)
  const inspectorOpen = useShellStore((state) => state.inspectorVisible)
  const toggleInspector = useShellStore((state) => state.toggleInspector)
  const showSidebar = layout === 'split' && sidebarOpen

  return (
    <Tabs>
      <View
        className="flex-1 flex-row gap-2 bg-background p-2"
        /* nativewind-allow-style: the window's safe area is owned HERE, once, so the panels
           inside it are plain columns. Each one used to clear the status bar and the home
           indicator for itself, which is three chances to disagree by a point. */
        style={{
          paddingBottom: insets.bottom + 8,
          paddingLeft: insets.left + 8,
          paddingRight: insets.right + 8,
          paddingTop: insets.top + 8,
        }}
      >
        {showSidebar ? (
          <View
            /* nativewind-allow-style: the column's width is half of the threshold that decides
               whether it appears at all, so both live on the same constant. */
            style={{ width: HUB_SIDEBAR_WIDTH }}
          >
            <TabletSidebar />
          </View>
        ) : null}

        {/* The viewer card. Fixed slot: this subtree must keep its identity across every layout
            change, or a resize would remount the stack inside it. */}
        {/* panel-card-allow: a shell panel, not a content card. `PANEL_CARD`'s `rounded-2xl`
            is the radius of a thing INSIDE a surface; the window's own panes take the web
            client's `rounded-xl`, and a 2xl pane around 2xl cards reads as a card of cards. */}
        <View className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
          <ColumnChrome>
            <ShellControls
              leading={
                layout === 'split' ? (
                  <IconAction
                    accessibilityLabel="Toggle the navigation panel"
                    glyph="panelLeft"
                    selected={sidebarOpen}
                    testID="porcelain-tablet-toggle-sidebar"
                    tone="foreground"
                    onPress={toggleSidebar}
                  />
                ) : null
              }
              trailing={
                layout === 'split' ? (
                  <IconAction
                    accessibilityLabel="Toggle the companion panel"
                    glyph="panelRight"
                    selected={inspectorOpen}
                    testID="porcelain-tablet-toggle-inspector"
                    tone="foreground"
                    onPress={toggleInspector}
                  />
                ) : null
              }
            >
              <TabSlot />
            </ShellControls>
          </ColumnChrome>
        </View>

        {layout === 'split' && inspectorOpen ? (
          <View style={{ width: HUB_SIDEBAR_WIDTH }}>
            <SidebarInspector onClose={toggleInspector} />
          </View>
        ) : null}
      </View>

      {/* The declaration of what each tab is and where it points. Hidden, because the sidebar
          draws the destinations; `TabList` is still the only place they are declared. */}
      <TabList style={{ display: 'none' }}>
        {DESTINATIONS.map((destination) => (
          <TabTrigger key={destination.name} href={destination.href} name={destination.name} />
        ))}
      </TabList>
    </Tabs>
  )
}
