import { useGlobalSearchParams, usePathname } from 'expo-router'
import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconAction } from '@/components/panel-chrome'
import { pathFromSegments } from '@/features/files/file-paths'
import { TabletFileViewer } from '@/features/files/tablet-file-viewer'
import { QuickOpenDialog } from '@/features/quick-open/quick-open-dialog'
import { SettingsDialog } from '@/features/settings/settings-dialog'

import { DESTINATIONS } from './destinations'
import { HUB_SIDEBAR_WIDTH } from './shell-layout'
import { useShellStore } from './shell-store'
import { SurfacesPanel } from './surfaces-panel'
import { TabletSidebar } from './tablet-sidebar'
import { useShellLayout } from './use-app-window'
import { ColumnChrome, ShellControls } from './window-chrome'

/** Three-column tablet workspace with persistent file viewers and a routed slot for other surfaces. */
export function TabletShell(): React.JSX.Element {
  const pathname = usePathname()
  const params = useGlobalSearchParams<{ path?: string[]; line?: string }>()
  const viewingFile = pathname.startsWith('/file/')
  const filePath = viewingFile ? pathFromSegments(params.path ?? []) : ''
  const parsedLine = Number(params.line)
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
    <>
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
                      accessibilityLabel="Toggle the Surfaces panel"
                      glyph="panelRight"
                      selected={inspectorOpen}
                      testID="porcelain-tablet-toggle-inspector"
                      tone="foreground"
                      onPress={toggleInspector}
                    />
                  ) : null
                }
              >
                <TabletFileViewer
                  filePath={filePath}
                  line={Number.isInteger(parsedLine) && parsedLine > 0 ? parsedLine : undefined}
                  focused={viewingFile}
                />
                <View className="flex-1" style={{ display: viewingFile ? 'none' : 'flex' }}>
                  <TabSlot />
                </View>
              </ShellControls>
            </ColumnChrome>
          </View>

          {layout === 'split' && inspectorOpen ? (
            <View style={{ width: HUB_SIDEBAR_WIDTH }}>
              <SurfacesPanel />
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
      <SettingsDialog />
      <QuickOpenDialog />
    </>
  )
}
