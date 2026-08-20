import { type Href, useRouter } from 'expo-router'
import { Pressable, View } from 'react-native'

import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'
import { EmptyNote } from '@/components/panel-chrome'
import { SURFACE_GUTTER, SURFACE_ROW } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { Text } from '@/components/ui/text'
import { useHubRepoPath } from '@/features/projects'
import { projectNameOf } from '@/features/remote'
import { PhoneHeader } from '@/features/shell/phone-header'
import { cn } from '@/lib/utils'

type SurfaceRow = {
  readonly id: string
  readonly label: string
  readonly hint: string
  readonly glyph: ChromeIconName
  /** Route inside the Hub stack, or null when mobile has no panel for it yet. */
  readonly route: Href | null
}

/**
 * A Worktree's surfaces.
 *
 * Surfaces are no longer global tabs: you reach one THROUGH the checkout it belongs to, which
 * is the whole point of the change. The set mirrors the web rail (`surface-sidebar.tsx`:
 * Files · Changes · History · Git · Search · Canvas) plus Terminal, which is a mobile surface
 * the web rail does not list. Git and Canvas have no mobile panel; they say so rather than
 * pretending, because a row that opens an empty screen is worse than a row that explains.
 */
const SURFACE_ROWS: readonly SurfaceRow[] = [
  { id: 'files', label: 'Files', hint: 'Browse the tree', glyph: 'folder', route: '/files' },
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
    id: 'search',
    label: 'Search',
    hint: 'Search code and files',
    glyph: 'search',
    route: '/search',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    hint: 'Sessions in this checkout',
    glyph: 'terminal',
    route: '/terminal',
  },
  {
    id: 'git',
    label: 'Git',
    hint: 'Not built on mobile yet',
    glyph: 'commit',
    route: null,
  },
  {
    id: 'canvas',
    label: 'Canvas',
    hint: 'Not built on mobile yet',
    glyph: 'layers',
    route: null,
  },
]

export function WorktreeScreen(): React.JSX.Element {
  const router = useRouter()
  const repoPath = useHubRepoPath()

  return (
    <View className="flex-1 bg-background" testID="porcelain-worktree-screen">
      <PhoneHeader
        companion={false}
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
                router.push(
                  surface.route ?? {
                    params: { surface: surface.id },
                    pathname: '/unbuilt/[surface]',
                  },
                )
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
