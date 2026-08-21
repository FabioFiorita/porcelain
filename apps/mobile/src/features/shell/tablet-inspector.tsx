import { View } from 'react-native'

import { EmptyNote, IconAction } from '@/components/panel-chrome'
import { Text } from '@/components/ui/text'

import { useShellStore } from './shell-store'
import { surfaceSlots } from './surface-slots'
import { surfaceById } from './surfaces'
import { ColumnChrome } from './window-chrome'

/**
 * The tablet's trailing panel: the current surface's companion, beside the viewer instead of
 * over it.
 *
 * On a phone the companion is a presented sheet, because a phone column cannot hold two
 * scrolling regions at once. An iPad can, and the web client proves what that buys — the
 * suggestions, the pins and the recent queries stay readable while you work in the thing they
 * are about, instead of being a sheet you raise and dismiss.
 *
 * A surface without a companion says so rather than showing an empty panel. Changes is the one
 * that has none, here and on web: everything it would hold — suggestions, git commands, the
 * commit composer — belongs to the Git surface.
 */
export function SidebarInspector({ onClose }: { onClose: () => void }): React.JSX.Element {
  const surface = useShellStore((state) => state.activeSurface)
  const slots = surfaceSlots(surface)
  const Companion = slots.companion

  return (
    <View
      className="flex-1 overflow-hidden rounded-xl border border-border bg-background"
      testID="porcelain-tablet-inspector"
    >
      <View className="min-h-12 flex-row items-center gap-1 border-b border-border px-3 py-1.5">
        <Text className="min-w-0 flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
          {surfaceById(surface).label}
        </Text>
        <View className="-mr-2">
          <IconAction
            accessibilityLabel="Close the companion panel"
            glyph="close"
            testID="porcelain-tablet-inspector-close"
            tone="foreground"
            onPress={onClose}
          />
        </View>
      </View>
      <ColumnChrome>
        {Companion === undefined ? (
          <EmptyNote
            body="Suggestions, quick commands and the commit composer live on the Git surface."
            testID="porcelain-tablet-inspector-empty"
            title="No companion here"
          />
        ) : (
          <Companion active />
        )}
      </ColumnChrome>
    </View>
  )
}
