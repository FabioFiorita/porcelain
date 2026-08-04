import { SplitView } from 'expo-router/unstable-split-view'
import { useState } from 'react'
import { Platform, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { SurfaceId } from './mock-data'
import {
  CompanionColumn,
  PrimaryColumn,
  SupplementaryColumn,
  TabletHeader,
  ViewerCanvas,
} from './shell-chrome'
import { ShellSheets } from './shell-sheets'
import { useShellStore } from './shell-store'

/**
 * Tablet outer shell — iPad native SplitView, Android shared multi-column layout.
 * Surface selection is store-driven so primary · supplementary · viewer · companion
 * switch together. iOS SplitView auto-Slot hosts the route which reads the same store.
 */
export function TabletShell(): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const inspectorVisible = useShellStore((state) => state.inspectorVisible)
  const activeSurface = useShellStore((state) => state.activeSurface)
  const [primaryCollapsed, setPrimaryCollapsed] = useState(false)
  const usesNativeSplitView = Platform.OS === 'ios'
  const platformLabel = usesNativeSplitView ? 'iPad' : 'Android tablet'

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <TabletHeader platformLabel={platformLabel} />
      <View className="min-h-0 flex-1">
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
          <AndroidTabletColumns activeSurface={activeSurface} inspectorVisible={inspectorVisible} />
        )}
      </View>
      <ShellSheets />
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
      <View className="min-w-0" style={{ flex: 0.16 }}>
        <PrimaryColumn />
      </View>
      <View className="min-w-0" style={{ flex: 0.22 }}>
        <SupplementaryColumn primaryCollapsed={false} />
      </View>
      <View
        className="min-w-0 border-l border-border"
        style={{ flex: inspectorVisible ? 0.4 : 0.62 }}
      >
        <ViewerCanvas surfaceId={activeSurface} />
      </View>
      {inspectorVisible ? (
        <View className="min-w-0" style={{ flex: 0.22 }}>
          <CompanionColumn />
        </View>
      ) : null}
    </View>
  )
}
