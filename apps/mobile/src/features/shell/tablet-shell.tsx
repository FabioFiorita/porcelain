import { SplitView } from 'expo-router/unstable-split-view'
import { useEffect, useState } from 'react'
import { Linking, Platform, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ColumnOverflowProvider,
  CompanionColumn,
  PrimaryColumn,
  SupplementaryColumn,
  ViewerCanvas,
} from './shell-columns'
import { ShellSheets } from './shell-sheets'
import { useShellStore } from './shell-store'
import type { SurfaceId } from './surfaces'
import { TabletHeader } from './tablet-header'

/**
 * Tablet outer shell — iPad native SplitView, Android shared multi-column layout.
 * Surface selection is store-driven so primary · supplementary · viewer · companion
 * switch together. iOS SplitView auto-Slot hosts the route which reads the same store.
 *
 * Deep link `porcelain-dev://settings` (or `…/settings`) opens the Settings sheet —
 * tablet Settings is not a tab route like the phone.
 */
export function TabletShell(): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const inspectorVisible = useShellStore((state) => state.inspectorVisible)
  const activeSurface = useShellStore((state) => state.activeSurface)
  const openSheet = useShellStore((state) => state.openSheet)
  const [primaryCollapsed, setPrimaryCollapsed] = useState(false)
  const usesNativeSplitView = Platform.OS === 'ios'
  const platformLabel = usesNativeSplitView ? 'iPad' : 'Android tablet'
  // How far the header pushes the SplitView down. The native columns are laid out at the full
  // window height regardless, so this is exactly how far each one overruns the bottom of the
  // screen — see `ColumnOverflowContext`. Android lays its own columns out and needs none of it.
  const [columnOverflow, setColumnOverflow] = useState(0)

  useEffect(() => {
    const openFromUrl = (url: string): void => {
      try {
        const path = url.split('://')[1] ?? url
        if (path === 'settings' || path.startsWith('settings?') || path.endsWith('/settings')) {
          openSheet('settings')
        }
      } catch {
        // Ignore malformed deep links.
      }
    }
    Linking.getInitialURL().then((url) => {
      if (url !== null) openFromUrl(url)
    })
    const sub = Linking.addEventListener('url', (event) => {
      openFromUrl(event.url)
    })
    return () => {
      sub.remove()
    }
  }, [openSheet])

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <TabletHeader platformLabel={platformLabel} />
      <View
        className="min-h-0 flex-1"
        onLayout={(event) => {
          // `layout.y` already counts the root's top inset padding, so it is the split view's
          // absolute offset from the top of the window — and its overrun past the bottom.
          if (!usesNativeSplitView) return
          setColumnOverflow(event.nativeEvent.layout.y)
        }}
      >
        <ColumnOverflowProvider value={columnOverflow}>
          {usesNativeSplitView ? (
            <SplitView
              columnMetrics={{
                preferredInspectorColumnWidthOrFraction: 0.22,
                preferredPrimaryColumnWidthOrFraction: 0.16,
                preferredSecondaryColumnWidthOrFraction: 0.4,
                preferredSupplementaryColumnWidthOrFraction: 0.22,
              }}
              preferredDisplayMode="twoBesideSecondary"
              preferredSplitBehavior="tile"
              onDisplayModeWillChange={(event) => {
                setPrimaryCollapsed(event.nativeEvent.nextDisplayMode === 'oneBesideSecondary')
              }}
              primaryBackgroundStyle="none"
              showInspector={inspectorVisible}
              topColumnForCollapsing="primary"
            >
              <SplitView.Column>
                <PrimaryColumn />
              </SplitView.Column>
              <SplitView.Column>
                <SupplementaryColumn primaryCollapsed={primaryCollapsed} />
              </SplitView.Column>
              <SplitView.Inspector>
                <CompanionColumn />
              </SplitView.Inspector>
            </SplitView>
          ) : (
            <AndroidTabletColumns
              activeSurface={activeSurface}
              inspectorVisible={inspectorVisible}
            />
          )}
        </ColumnOverflowProvider>
      </View>
      <ShellSheets variant="tablet" />
    </View>
  )
}

function AndroidTabletColumns({
  inspectorVisible,
  activeSurface,
}: {
  inspectorVisible: boolean
  activeSurface: SurfaceId
}): React.JSX.Element {
  return (
    <View className="flex-1 flex-row bg-background">
      {/* nativewind-allow-style: Android tablet columns use fractional flex geometry. */}
      <View className="min-w-0" style={{ flex: 0.16 }}>
        <PrimaryColumn />
      </View>
      {/* nativewind-allow-style: Android tablet columns use fractional flex geometry. */}
      <View className="min-w-0" style={{ flex: 0.22 }}>
        <SupplementaryColumn primaryCollapsed={false} />
      </View>
      {/* nativewind-allow-style: the viewer fraction changes with the inspector column. */}
      <View
        className="min-w-0 border-l border-border"
        style={{ flex: inspectorVisible ? 0.4 : 0.62 }}
      >
        <ViewerCanvas surfaceId={activeSurface} />
      </View>
      {inspectorVisible ? (
        /* nativewind-allow-style: Android tablet columns use fractional flex geometry. */
        <View className="min-w-0" style={{ flex: 0.22 }}>
          <CompanionColumn />
        </View>
      ) : null}
    </View>
  )
}
