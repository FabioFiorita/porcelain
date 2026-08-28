import { TabTrigger } from 'expo-router/ui'
import { Pressable, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { useShellStore } from '@/features/shell/shell-store'
import { useIsTablet } from '@/features/shell/use-app-window'
import { useHubOverlayStore } from './hub-overlay-store'

const HEADER_ICON = 'min-h-11 min-w-9 items-center justify-center active:opacity-50'

/** The `+` in the Worktrees list's bar — it presents the New Worktree sheet. */
export function NewWorktreeHeaderAction(): React.JSX.Element {
  const openProjectPicker = useHubOverlayStore((state) => state.openProjectPicker)

  return (
    <Pressable
      accessibilityLabel="Open project"
      accessibilityRole="button"
      className={HEADER_ICON}
      hitSlop={8}
      testID="porcelain-hub-open-project"
      onPress={openProjectPicker}
    >
      <ChromeGlyph name="plus" size={19} tone="foreground" />
    </Pressable>
  )
}

/**
 * Settings, first in the Worktrees header.
 *
 * Phone: a `TabTrigger` onto the Settings stack. Tablet: the Settings dialog, the same overlay
 * the web and Mac apps use.
 */
export function SettingsHeaderAction(): React.JSX.Element {
  const isTablet = useIsTablet()
  const openSettings = useShellStore((state) => state.openSettings)
  if (isTablet) {
    return (
      <Pressable
        accessibilityLabel="Settings"
        accessibilityRole="button"
        className={HEADER_ICON}
        hitSlop={8}
        testID="porcelain-hub-settings"
        onPress={() => {
          openSettings()
        }}
      >
        <ChromeGlyph name="settings" size={19} tone="foreground" />
      </Pressable>
    )
  }
  return (
    <TabTrigger asChild name="settings">
      <Pressable
        accessibilityLabel="Settings"
        accessibilityRole="button"
        className={HEADER_ICON}
        hitSlop={8}
        testID="porcelain-hub-settings"
      >
        <ChromeGlyph name="settings" size={19} tone="foreground" />
      </Pressable>
    </TabTrigger>
  )
}

/** The Worktrees header cluster: Settings, then open Project. */
export function HubHeaderActions(): React.JSX.Element {
  return (
    <View className="flex-row items-center">
      <SettingsHeaderAction />
      <NewWorktreeHeaderAction />
    </View>
  )
}
