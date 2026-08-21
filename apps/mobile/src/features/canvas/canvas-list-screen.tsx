import type { CanvasRecord } from '@porcelain/contracts/projects'
import { useIsFocused, useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { EmptyNote, ErrorNote, PanelLabel, ScreenHeader } from '@/components/panel-chrome'
import { SURFACE_GUTTER, SURFACE_ROW } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { describeCommentCounts, useReviewComments } from '@/features/comments'
import { useHubRepoPath } from '@/features/projects'
import { cn } from '@/lib/utils'

import { useCanvasList } from './canvas-data'

/**
 * The Canvas surface: every Canvas the selected Worktree resolves, plus the review comments
 * left on that checkout.
 *
 * Both halves are here because a Canvas is only half the Review — the agent's explanation is
 * what the human answers, and on a phone the answer has nowhere else to live. They are two
 * unrelated wire shapes though: a Canvas belongs to the Project, a comment to the checkout,
 * and no contract joins them, so the comments are a destination rather than a badge on a row.
 */
export function CanvasListScreen(): React.JSX.Element {
  const focused = useIsFocused()
  const repoPath = useHubRepoPath()
  const router = useRouter()
  const { canvases, isLoading, loadError } = useCanvasList(focused)
  const comments = useReviewComments(focused)

  return (
    <View className="flex-1 bg-background" testID="porcelain-canvas-screen">
      <ScreenHeader
        back={{
          accessibilityLabel: 'Back',
          testID: 'porcelain-canvas-back',
          onPress: () => {
            router.back()
          },
        }}
        testID="porcelain-canvas-header"
        title="Canvas"
      />
      {repoPath === null ? (
        <EmptyNote
          body="Pick a worktree from the list first — a Canvas belongs to the checkout you open it from."
          testID="porcelain-canvas-empty"
          title="No worktree selected"
        />
      ) : (
        <SurfaceScroll edgeToEdge gap={2} paddingTop={8}>
          {loadError === null ? null : (
            <View className={SURFACE_GUTTER}>
              <ErrorNote message={loadError} testID="porcelain-canvas-error" />
            </View>
          )}

          <Pressable
            accessibilityLabel="Review comments"
            accessibilityRole="button"
            className={cn(SURFACE_ROW, 'flex-row items-center gap-3')}
            testID="porcelain-canvas-comments-row"
            onPress={() => {
              router.push('/canvas/comments')
            }}
          >
            <ChromeGlyph name="comment" size={17} tone="muted" />
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-medium text-foreground">Review comments</Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {describeCommentCounts(comments)}
              </Text>
            </View>
            <ChromeGlyph name="chevronRight" size={15} tone="muted" />
          </Pressable>

          <PanelLabel className={cn(SURFACE_GUTTER, 'pt-4')}>Canvases</PanelLabel>
          {canvases.length === 0 ? (
            <EmptyNote
              body={
                isLoading
                  ? 'Reading this Worktree’s Canvases…'
                  : 'An agent-authored explanation shows up here once one is written.'
              }
              testID="porcelain-canvas-list-empty"
              title={isLoading ? 'Loading' : 'No Canvases yet'}
            />
          ) : (
            canvases.map((canvas) => (
              <CanvasRow
                key={canvas.id}
                canvas={canvas}
                onOpen={() => {
                  router.push({ params: { id: canvas.id }, pathname: '/canvas/doc/[id]' })
                }}
              />
            ))
          )}
        </SurfaceScroll>
      )}
    </View>
  )
}

/**
 * One Canvas. The subtitle is the web row's, verbatim — kind and the daemon's own `updatedAt`
 * string, because nothing here knows a timezone the daemon did not send.
 */
function CanvasRow({
  canvas,
  onOpen,
}: {
  canvas: CanvasRecord
  onOpen: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={canvas.title}
      accessibilityRole="button"
      className={cn(SURFACE_ROW, 'flex-row items-center gap-3')}
      testID={`porcelain-canvas-item-${canvas.id}`}
      onPress={onOpen}
    >
      <ChromeGlyph name="layers" size={17} tone="muted" />
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {canvas.title}
        </Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {canvas.kind} · {canvas.updatedAt}
        </Text>
      </View>
      {canvas.tracked ? (
        <Text
          className="rounded-md bg-secondary px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-widest text-secondary-foreground"
          testID={`porcelain-canvas-tracked-${canvas.id}`}
        >
          Tracked
        </Text>
      ) : null}
      <ChromeGlyph name="chevronRight" size={15} tone="muted" />
    </Pressable>
  )
}
