import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MOCK_WORKSPACE, type SurfaceId } from './mock-data'
import { ChromeGlyph } from './shell-icon'
import { useShellStore } from './shell-store'

type PhoneHeaderProps = {
  /** Large title — active face name (Files, Search, Changes, …). */
  title: string
  /**
   * Surface the bolt companion should open for. Defaults to store activeSurface
   * when omitted (settings tab has no product surface).
   */
  companionSurface?: SurfaceId
  /** Hide workspace chips (Settings). */
  workspace?: boolean
}

/**
 * Phone title bar:
 *   [ Title                          ⚡ ]
 *   [ project · branch · worktree       ]
 *
 * No gear (Settings is a tab). No environment chip (lives in Settings).
 * Bolt always opens the companion sheet for the current surface.
 */
export function PhoneHeader({
  title,
  companionSurface,
  workspace = true,
}: PhoneHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const openSheet = useShellStore((state) => state.openSheet)
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)

  return (
    <View
      className="border-b border-border bg-background px-4 pb-2.5"
      style={{ paddingTop: Math.max(insets.top, 8) + 4 }}
      testID="porcelain-phone-header"
    >
      <View className="min-h-11 flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text
            accessibilityRole="header"
            className="text-[28px] font-extrabold tracking-tight text-foreground"
            numberOfLines={1}
            testID="porcelain-phone-title"
          >
            {title}
          </Text>
          {workspace ? (
            <View className="flex-row flex-wrap items-center gap-1.5 pt-0.5">
              <WorkspaceChip
                accessibilityLabel={`Project ${MOCK_WORKSPACE.projectName}`}
                label={MOCK_WORKSPACE.projectName}
                testID="porcelain-phone-project"
                onPress={() => {
                  openSheet('project')
                }}
              />
              <Text className="text-xs text-muted-foreground">·</Text>
              <WorkspaceChip
                accessibilityLabel={`Branch ${MOCK_WORKSPACE.branch}`}
                label={MOCK_WORKSPACE.branch}
                testID="porcelain-phone-branch"
                onPress={() => {
                  openSheet('branch')
                }}
              />
              <Text className="text-xs text-muted-foreground">·</Text>
              <WorkspaceChip
                accessibilityLabel={`Worktree ${MOCK_WORKSPACE.worktree}`}
                label={MOCK_WORKSPACE.worktree}
                testID="porcelain-phone-worktree"
                onPress={() => {
                  openSheet('worktree')
                }}
              />
            </View>
          ) : null}
        </View>

        <Pressable
          accessibilityLabel="Companion"
          accessibilityRole="button"
          className="mt-0.5 size-10 items-center justify-center rounded-xl border border-border bg-card active:bg-accent"
          testID="porcelain-phone-bolt"
          onPress={() => {
            if (companionSurface !== undefined) {
              setActiveSurface(companionSurface)
            }
            openSheet('companion')
          }}
        >
          <ChromeGlyph name="companion" size={17} tone="foreground" />
        </Pressable>
      </View>
    </View>
  )
}

function WorkspaceChip({
  accessibilityLabel,
  label,
  onPress,
  testID,
}: {
  accessibilityLabel: string
  label: string
  onPress: () => void
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className="flex-row items-center gap-0.5 rounded-md px-0.5 py-0.5 active:bg-accent"
      testID={testID}
      onPress={onPress}
    >
      <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
        {label}
      </Text>
      <ChromeGlyph name="chevron" size={10} />
    </Pressable>
  )
}
