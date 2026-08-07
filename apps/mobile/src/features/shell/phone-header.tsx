import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChromeGlyph } from '@/components/chrome-glyph'
import { SURFACE_HEADER_BAND } from '@/components/surface-layout'
import { cn } from '@/lib/utils'
import type { SurfaceId } from './mock-data'
import { useShellStore } from './shell-store'
import { useWorkspaceHeader } from './workspace-switchers'

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
  /**
   * Companion bolt. Product tabs keep it; Settings drops it — prefs have no
   * companion rail content.
   */
  companion?: boolean
  /**
   * Bottom border under the title band. Settings puts the border under its
   * section tabs instead so the tabs read as part of the header; the band it
   * passes as `children` owns the divider in that case.
   */
  border?: boolean
  /** Optional content under the title row (Settings section tabs). */
  children?: React.ReactNode
}

/**
 * Phone title bar:
 *   [ Title                                    ⚡ ]
 *   [ PROJECT ⌄ ][ BRANCH ⌄ ][ WORKTREE ⌄        ]
 *
 * No gear (Settings is a tab). No environment chip (lives in Settings).
 * Bolt opens the companion sheet on product surfaces.
 *
 * The three switchers are captioned rather than run together as `name · name · name`. Two of
 * the three routinely print the same string — a checkout's worktree is named for the branch in
 * it — so an unlabelled row asked the reader to tell three identical-looking chips apart by
 * position. The tablet header already solved this with captioned chips; this is the same
 * control at phone scale.
 */
export function PhoneHeader({
  title,
  companionSurface,
  workspace = true,
  companion = true,
  border = true,
  children,
}: PhoneHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const openSheet = useShellStore((state) => state.openSheet)
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)
  const { branch, repo, worktree } = useWorkspaceHeader()
  const projectName = repo?.name ?? 'Project'

  return (
    <View
      className={cn('bg-background', border && 'border-b border-border')}
      /* nativewind-allow-style: the band clears the live status-bar inset. */
      style={{ paddingTop: Math.max(insets.top, 8) + 4 }}
      testID="porcelain-phone-header"
    >
      <View className={SURFACE_HEADER_BAND}>
        <View className="min-h-11 flex-row items-center justify-between gap-3">
          <Text
            accessibilityRole="header"
            className="min-w-0 flex-1 text-[28px] font-extrabold tracking-tight text-foreground"
            numberOfLines={1}
            testID="porcelain-phone-title"
          >
            {title}
          </Text>

          {companion ? (
            <Pressable
              accessibilityLabel="Companion"
              accessibilityRole="button"
              className="size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card active:bg-accent"
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
          ) : null}
        </View>

        {workspace ? (
          <View className="flex-row items-stretch gap-1.5 pt-1.5">
            <WorkspaceChip
              accessibilityLabel={`Project ${projectName}`}
              caption="Project"
              label={projectName}
              testID="porcelain-phone-project"
              onPress={() => {
                openSheet('project')
              }}
            />
            <WorkspaceChip
              accessibilityLabel={`Branch ${branch}`}
              caption="Branch"
              label={branch}
              testID="porcelain-phone-branch"
              onPress={() => {
                openSheet('branch')
              }}
            />
            <WorkspaceChip
              accessibilityLabel={`Worktree ${worktree}`}
              caption="Worktree"
              label={worktree}
              testID="porcelain-phone-worktree"
              onPress={() => {
                openSheet('worktree')
              }}
            />
          </View>
        ) : null}
      </View>
      {children}
    </View>
  )
}

/**
 * One switcher. Equal thirds rather than content width: a branch name is arbitrarily long, and
 * letting it size the chip pushes the other two off the row — the tail of the name is what the
 * sheet is for.
 */
function WorkspaceChip({
  accessibilityLabel,
  caption,
  label,
  onPress,
  testID,
}: {
  accessibilityLabel: string
  caption: string
  label: string
  onPress: () => void
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className="min-w-0 flex-1 flex-row items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 active:bg-accent"
      testID={testID}
      onPress={onPress}
    >
      <View className="min-w-0 flex-1">
        <Text className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
          {caption}
        </Text>
        <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <ChromeGlyph name="chevron" size={9} />
    </Pressable>
  )
}
