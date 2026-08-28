import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { EmptyNote, ScreenHeader } from '@/components/panel-chrome'
import { SURFACE_ROW } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { useHubRepoPath } from '@/features/projects'
import { projectNameOf } from '@/features/remote'
import { HeaderActions } from '@/features/shell/header-actions'
import { useShellStore } from '@/features/shell/shell-store'
import { SURFACES } from '@/features/shell/surfaces'
import { useShellLayout } from '@/features/shell/use-app-window'

/**
 * A Worktree: what you are standing in, and the way into its surfaces.
 *
 * **On a phone the surfaces are a list here.** Surfaces are not global tabs — you reach one
 * THROUGH the checkout it belongs to — and a phone has one column, so a list of six rows is the
 * whole navigation. The set and its order are `SURFACES`, shared with the tablet's panel and the
 * quick-open palette so there is one answer to what a surface is.
 *
 * **On a tablet with panels, this screen is the empty viewer.** The surfaces live in the trailing
 * Surfaces panel, the way the Mac app and the web client arrange them; printing the same six rows
 * in the centre column would put a menu where the file, the diff or the Canvas belongs, with the
 * panel that actually opens them sitting right beside it. So the viewer says what is open —
 * nothing yet — and names where to open something from. The rows come back the moment the panel
 * is closed or the window is too narrow for it, which is the phone's shape.
 *
 * The back chevron goes with them: at split width the Worktree list is the sidebar, permanently
 * on screen, so there is nothing behind this screen to go back to.
 */
export function WorktreeScreen(): React.JSX.Element {
  const router = useRouter()
  const repoPath = useHubRepoPath()
  const inPanels = useShellLayout() === 'split'
  const surfacesInPanel = useShellStore((state) => state.inspectorVisible)
  const openSurface = useShellStore((state) => state.openSurface)
  const showPanelRest = inPanels && surfacesInPanel

  return (
    <View className="flex-1 bg-background" testID="porcelain-worktree-screen">
      {/* The title is the checkout you are in, so the screen sets it rather than the layout. */}
      <ScreenHeader
        actions={<HeaderActions />}
        back={
          inPanels
            ? undefined
            : {
                accessibilityLabel: 'Back to Worktrees',
                testID: 'porcelain-worktree-back',
                onPress: () => {
                  router.back()
                },
              }
        }
        testID="porcelain-worktree-header"
        title={repoPath === null ? 'Worktree' : projectNameOf(repoPath)}
      />
      {repoPath === null ? (
        <EmptyNote
          body="Pick a worktree from the list first."
          testID="porcelain-worktree-empty"
          title="No worktree selected"
        />
      ) : showPanelRest ? (
        <EmptyNote
          body="Open a file, a diff, a commit or a Canvas from the Surfaces panel and it shows up here."
          testID="porcelain-worktree-viewer-empty"
          title="Nothing open"
        />
      ) : (
        <SurfaceScroll edgeToEdge gap={2} paddingTop={8}>
          {SURFACES.map((surface) => (
            <Pressable
              key={surface.id}
              accessibilityLabel={surface.label}
              accessibilityRole="button"
              className={SURFACE_ROW}
              testID={`porcelain-worktree-surface-${surface.id}`}
              onPress={() => {
                // Report it into the shell too: a window that widens back into panels should
                // find the surface you were last in already on the strip.
                openSurface(surface.id)
                router.push(surface.route)
              }}
            >
              <View className="flex-row items-center gap-3">
                <ChromeGlyph name={surface.glyph} size={16} tone="muted" />
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-medium text-foreground">{surface.label}</Text>
                  <Text className="text-3xs text-muted-foreground">{surface.hint}</Text>
                </View>
                <ChromeGlyph name="chevronRight" size={11} tone="muted" />
              </View>
            </Pressable>
          ))}
        </SurfaceScroll>
      )}
    </View>
  )
}
