import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { cn } from '@/lib/utils'

import { useShellStore } from './shell-store'
import { useIsAppFullscreen } from './use-app-window'
import { useWorkspaceHeader } from './use-workspace'

/**
 * Tablet title bar — web geometry:
 * - Search is absolutely centered in the full bar (not leftover flex space).
 * - Project is an avatar-only switcher (web rail pattern); name lives in a11y + sheet.
 * - Left/right clusters are content-width only so they never cover the search hit target.
 */
export function TabletHeader(_props: { platformLabel: string }): React.JSX.Element {
  const openSheet = useShellStore((state) => state.openSheet)
  const toggleInspector = useShellStore((state) => state.toggleInspector)
  const inspectorVisible = useShellStore((state) => state.inspectorVisible)
  const isFullscreen = useIsAppFullscreen()
  const { branch, environmentLabel, projectInitial, projectName, repo, worktree } =
    useWorkspaceHeader()

  return (
    <View className="border-b border-border bg-background px-3 pb-2 pt-1.5">
      <View className="relative h-12">
        {/* True window center — independent of asymmetric left/right chrome. */}
        <View
          pointerEvents="box-none"
          className="absolute inset-0 z-0 items-center justify-center px-14"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search files, folders, commands, commits"
            className="h-10 w-full max-w-[27.5rem] flex-row items-center gap-2 rounded-xl border border-border/70 bg-muted px-3 active:bg-accent"
            testID="porcelain-tablet-search"
            onPress={() => {
              openSheet('search')
            }}
          >
            <ChromeGlyph name="search" size={15} />
            <Text className="min-w-0 flex-1 text-sm text-muted-foreground" numberOfLines={1}>
              Search files, folders, commands…
            </Text>
          </Pressable>
        </View>

        {/* Left: avatar project + branch + worktree (content-width, above search layer). */}
        <View
          className={cn(
            'absolute bottom-0 left-0 top-0 z-10 flex-row items-center gap-2',
            isFullscreen ? 'pl-1' : 'pl-[72px]',
          )}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Switch project${repo === null ? '' : `, ${projectName}`}`}
            className="relative size-10 items-center justify-center rounded-xl border border-border bg-secondary active:bg-accent"
            testID="porcelain-tablet-project"
            onPress={() => {
              openSheet('project')
            }}
          >
            <Text className="text-sm font-semibold text-foreground">{projectInitial}</Text>
            <View className="absolute -bottom-0.5 -right-0.5 size-3.5 items-center justify-center rounded-full border border-border bg-card">
              <ChromeGlyph name="chevron" size={8} />
            </View>
          </Pressable>

          <HeaderChip
            accessibilityLabel={`Branch ${branch}`}
            label={branch}
            onPress={() => {
              openSheet('branch')
            }}
            subtitle="Branch"
            testID="porcelain-tablet-branch"
          />
          <HeaderChip
            accessibilityLabel={`Worktree ${worktree}`}
            label={worktree}
            onPress={() => {
              openSheet('worktree')
            }}
            subtitle="Worktree"
            testID="porcelain-tablet-worktree"
          />
        </View>

        {/* Right: settings → bolt → environment */}
        <View className="absolute bottom-0 right-0 top-0 z-10 flex-row items-center gap-2">
          <HeaderIconButton
            accessibilityLabel="Settings"
            onPress={() => {
              openSheet('settings')
            }}
            symbol="settings"
            testID="porcelain-tablet-settings"
          />
          <HeaderIconButton
            accessibilityLabel={inspectorVisible ? 'Hide companion' : 'Show companion'}
            onPress={toggleInspector}
            symbol="companion"
            testID="porcelain-tablet-companion"
          />
          {/* panel-card-allow: a 40pt chip in the header rail, not a card. */}
          <View className="h-10 shrink-0 justify-center rounded-xl border border-border bg-card px-3">
            <Text className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
              Environment
            </Text>
            <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
              {environmentLabel}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

function HeaderChip({
  accessibilityLabel,
  label,
  subtitle,
  onPress,
  testID,
}: {
  accessibilityLabel: string
  label: string
  subtitle: string
  onPress: () => void
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      /* panel-card-allow: a 40pt chip, not a card. */
      className="h-10 shrink-0 flex-row items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 active:bg-accent"
      testID={testID}
      onPress={onPress}
    >
      <View className="gap-0.5">
        <Text className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
          {subtitle}
        </Text>
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <ChromeGlyph name="chevron" size={12} />
    </Pressable>
  )
}

/** Icon control — matches search / env chip height. */
function HeaderIconButton({
  accessibilityLabel,
  onPress,
  symbol,
  testID,
}: {
  accessibilityLabel: string
  onPress: () => void
  symbol: 'settings' | 'companion'
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      /* panel-card-allow: a 40pt control, not a card. */
      className="size-10 items-center justify-center rounded-xl border border-border bg-card active:bg-accent"
      testID={testID}
      onPress={onPress}
    >
      <ChromeGlyph name={symbol} size={16} tone="foreground" />
    </Pressable>
  )
}
