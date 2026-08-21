import { type Href, useRouter } from 'expo-router'
import { Pressable, View } from 'react-native'

import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'
import { EmptyNote, ScreenHeader } from '@/components/panel-chrome'
import { SURFACE_GUTTER, SURFACE_ROW } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { Text } from '@/components/ui/text'
import { useHubRepoPath } from '@/features/projects'
import { projectNameOf } from '@/features/remote'
import { HeaderActions } from '@/features/shell/header-actions'
import { cn } from '@/lib/utils'

type SurfaceRow = {
  readonly id: string
  readonly label: string
  readonly hint: string
  readonly glyph: ChromeIconName
  /** Route inside the Hub stack. Every surface has one — a row that opens nothing is not a row. */
  readonly route: Href
}

/**
 * A Worktree's surfaces.
 *
 * Surfaces are no longer global tabs: you reach one THROUGH the checkout it belongs to, which
 * is the whole point of the change. The set and its order mirror the web rail
 * (`surface-sidebar.tsx`): Files · Changes · History · Git · Search · Canvas.
 *
 * Terminal is not here. A shell belongs to the daemon, not to one checkout, so it is a tab of
 * its own (`app/terminals/`) — the same move web made when the docked panel became the one
 * Terminals surface.
 */
const SURFACE_ROWS: readonly SurfaceRow[] = [
  {
    id: 'files',
    label: 'Files',
    hint: 'Browse the project tree',
    glyph: 'folder',
    route: '/files',
  },
  {
    id: 'changes',
    label: 'Changes',
    hint: 'Review working-tree changes',
    glyph: 'branch',
    route: '/changes',
  },
  {
    id: 'history',
    label: 'History',
    hint: 'Inspect commit history',
    glyph: 'copy',
    route: '/history',
  },
  {
    id: 'git',
    label: 'Git',
    hint: 'Commands, suggestions, and commit',
    glyph: 'commit',
    route: '/git',
  },
  {
    id: 'search',
    label: 'Search',
    hint: 'Search code and files',
    glyph: 'search',
    route: '/search',
  },
  {
    id: 'canvas',
    label: 'Canvas',
    hint: 'Agent-authored explanation for this Project',
    glyph: 'layers',
    route: '/canvas',
  },
]

export function WorktreeScreen(): React.JSX.Element {
  const router = useRouter()
  const repoPath = useHubRepoPath()

  return (
    <View className="flex-1 bg-background" testID="porcelain-worktree-screen">
      {/* The title is the checkout you are in, so the screen sets it rather than the layout.
          No companion bolt: a Worktree is a list of surfaces and the companion belongs to a
          surface. */}
      <ScreenHeader
        actions={<HeaderActions />}
        back={{
          accessibilityLabel: 'Back to Worktrees',
          testID: 'porcelain-worktree-back',
          onPress: () => {
            router.back()
          },
        }}
        testID="porcelain-worktree-header"
        title={repoPath === null ? 'Worktree' : projectNameOf(repoPath)}
      />
      {repoPath === null ? (
        <EmptyNote
          body="Pick a worktree from the list first."
          testID="porcelain-worktree-empty"
          title="No worktree selected"
        />
      ) : (
        <SurfaceScroll gap={2} paddingTop={8}>
          <Text
            className={cn(SURFACE_GUTTER, 'pb-2 font-mono text-3xs text-muted-foreground')}
            ellipsizeMode="head"
            numberOfLines={1}
          >
            {repoPath}
          </Text>
          {SURFACE_ROWS.map((surface) => (
            <Pressable
              key={surface.id}
              accessibilityLabel={surface.label}
              accessibilityRole="button"
              className={SURFACE_ROW}
              testID={`porcelain-worktree-surface-${surface.id}`}
              onPress={() => {
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
