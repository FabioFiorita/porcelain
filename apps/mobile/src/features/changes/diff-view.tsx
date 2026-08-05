import { fileName } from '@porcelain/client-runtime/paths'
import { intraLineEmphasis } from '@porcelain/client-runtime/word-diff-line'
import { useMemo, useState } from 'react'
import { FlatList, Image, Text, View } from 'react-native'

import { usePreferencesStore } from '@/features/settings/preferences-store'
import type { DiffHunk } from '@/lib/daemon/procedures/changes'
import { cn } from '@/lib/utils'

import { EmptyNote, ErrorNote, IconAction } from './changes-chrome'
import { type CommentAnchor, CommentComposer } from './comment-composer'
import { DiffRowView } from './diff-lines'
import { type DiffRow, toDiffRows } from './diff-rows'
import { anchorTextFor, rangeForPath } from './line-selection'
import { SelectionBar } from './selection-bar'
import { useDiffFile, useReviewedPaths, useToggleReviewed } from './use-changes'
import { useCommentIndex, useReviewComments } from './use-comments'
import { useDiffTokens } from './use-highlight'
import { useLineSelection } from './use-line-selection'

/**
 * One file's diff. The unified / split choice is a Settings preference rather than a control
 * in this header — a phone has no room for two code columns, and the toggle would be a
 * per-viewer decision the user has already made once.
 */
export function DiffView({
  active,
  base,
  bottomInset = 0,
  filePath,
  onBack,
  topInset = 0,
}: {
  active: boolean
  /** Branch scope base ref; `undefined` reads the working tree. */
  base: string | undefined
  /** Phone: room for the floating tab bar the rows scroll under. */
  bottomInset?: number
  filePath: string
  /** Phone: pop back to the list. Omitted on tablet, where the list is always on screen. */
  onBack?: () => void
  /** Phone: this view replaces the tab header, so it owns the status-bar inset. */
  topInset?: number
}): React.JSX.Element {
  const { error, isLoading, result } = useDiffFile(filePath, base, active)
  const reviewedPaths = useReviewedPaths(active)
  const { mark, unmark } = useToggleReviewed()
  const preferredMode = usePreferencesStore((state) => state.diffMode)
  const comments = useReviewComments(active)
  const commentIndex = useCommentIndex(comments, filePath)
  const [anchor, setAnchor] = useState<CommentAnchor | null>(null)
  const lineSelection = useLineSelection()
  const isReviewed = reviewedPaths.has(filePath)

  const hunks: readonly DiffHunk[] = result?.hunks ?? []
  const rows = useMemo(() => toDiffRows(hunks, preferredMode), [hunks, preferredMode])
  const emphasis = useMemo(() => intraLineEmphasis(hunks), [hunks])
  const commentedLines = useMemo(() => new Set(commentIndex.byLine.keys()), [commentIndex])
  const diffTokens = useDiffTokens()
  const tokens = useMemo(() => diffTokens(filePath, hunks), [diffTokens, filePath, hunks])
  const selected = rangeForPath(lineSelection.selection, filePath)
  const { extend, start } = lineSelection
  const ctx = useMemo(
    () => ({
      commentedLines,
      emphasis,
      onAnchorLine: (line: number): void => {
        start(filePath, line)
      },
      onExtendToLine: (line: number): void => {
        extend(filePath, line)
      },
      selected,
      tokens,
    }),
    [commentedLines, emphasis, extend, filePath, selected, start, tokens],
  )

  const handleCommentSelection = (): void => {
    if (selected === null) return
    setAnchor({
      anchorText: anchorTextFor(hunks, selected),
      endLine: selected.endLine,
      path: filePath,
      startLine: selected.startLine,
    })
    lineSelection.clear()
  }

  return (
    <View className="flex-1 bg-background" testID="porcelain-changes-diff">
      <DiffHeader
        filePath={filePath}
        topInset={topInset}
        isReviewed={isReviewed}
        onBack={onBack}
        onComment={() => {
          setAnchor({ path: filePath })
        }}
        onToggleReviewed={() => {
          if (isReviewed) unmark(filePath)
          else mark(filePath)
        }}
      />
      <DiffBody
        binary={result?.binary === true}
        bottomInset={bottomInset}
        ctx={ctx}
        error={error}
        image={result?.image}
        isLoading={isLoading}
        rows={rows}
        status={result?.status}
      />
      {selected === null ? null : (
        <SelectionBar
          bottomInset={bottomInset}
          path={filePath}
          range={selected}
          onCancel={lineSelection.clear}
          onComment={handleCommentSelection}
        />
      )}
      <CommentComposer
        anchor={anchor}
        onClose={() => {
          setAnchor(null)
        }}
      />
    </View>
  )
}

function DiffHeader({
  filePath,
  isReviewed,
  onBack,
  onComment,
  onToggleReviewed,
  topInset,
}: {
  filePath: string
  isReviewed: boolean
  onBack?: () => void
  onComment: () => void
  onToggleReviewed: () => void
  topInset: number
}): React.JSX.Element {
  return (
    <View
      className="flex-row items-center gap-1 border-b border-border px-2 py-1.5"
      style={{ paddingTop: topInset + 6 }}
    >
      {onBack === undefined ? null : (
        <IconAction
          accessibilityLabel="Back to changes"
          glyph="chevronLeft"
          testID="porcelain-changes-diff-back"
          tone="foreground"
          onPress={onBack}
        />
      )}
      <View className={cn('min-w-0 flex-1', onBack === undefined && 'pl-1.5')}>
        <Text className="font-mono text-xs font-medium text-foreground" numberOfLines={1}>
          {fileName(filePath)}
        </Text>
        <Text
          className="font-mono text-[10px] text-muted-foreground"
          ellipsizeMode="head"
          numberOfLines={1}
        >
          {filePath}
        </Text>
      </View>
      <IconAction
        accessibilityLabel={isReviewed ? 'Unmark reviewed' : 'Mark reviewed'}
        glyph={isReviewed ? 'squareCheck' : 'square'}
        selected={isReviewed}
        testID="porcelain-changes-diff-reviewed"
        tone={isReviewed ? 'success' : 'muted'}
        onPress={onToggleReviewed}
      />
      <IconAction
        accessibilityLabel="Comment on file"
        glyph="commentAdd"
        testID="porcelain-changes-diff-comment"
        onPress={onComment}
      />
      {/* TODO: opens the whole file in the Files viewer — lands with the Files tab, which is
          still the mock surface. Kept visible (and disabled) so the affordance's place in the
          header is settled now rather than relaid out later. */}
      <IconAction
        accessibilityLabel="Open file (available once the Files tab lands)"
        disabled
        glyph="file"
        testID="porcelain-changes-diff-open-file"
        onPress={() => undefined}
      />
    </View>
  )
}

function DiffBody({
  binary,
  bottomInset,
  ctx,
  error,
  image,
  isLoading,
  rows,
  status,
}: {
  binary: boolean
  bottomInset: number
  ctx: React.ComponentProps<typeof DiffRowView>['ctx']
  error: Error | null
  image: { dataUrl: string } | undefined
  isLoading: boolean
  rows: DiffRow[]
  status: string | undefined
}): React.JSX.Element {
  if (error !== null) {
    return (
      <View className="p-4">
        <ErrorNote message={error.message} testID="porcelain-changes-diff-error" />
      </View>
    )
  }
  if (isLoading) {
    return (
      <Text className="p-4 text-sm text-muted-foreground" testID="porcelain-changes-diff-loading">
        Loading…
      </Text>
    )
  }
  // Image and binary files have no text hunks: show the picture, or say so plainly, rather
  // than rendering a screenful of mojibake.
  if (image !== undefined) {
    return (
      <View className="flex-1 items-center justify-center gap-3 p-6">
        <Image
          accessibilityLabel="Changed image"
          className="h-3/4 w-full"
          resizeMode="contain"
          source={{ uri: image.dataUrl }}
        />
        <Text className="text-[11px] text-muted-foreground">
          {status === 'untracked' || status === 'added' ? 'New image' : 'Image changed'} · binary
          diff
        </Text>
      </View>
    )
  }
  if (binary) {
    return (
      <EmptyNote
        body="Porcelain doesn’t render a byte diff — read this one on the host."
        testID="porcelain-changes-diff-binary"
        title="Binary file"
      />
    )
  }
  if (rows.length === 0) {
    return (
      <EmptyNote
        body="This file is in the change set but its contents match — a mode or rename change."
        testID="porcelain-changes-diff-empty"
        title="No line changes"
      />
    )
  }
  return (
    <FlatList
      contentContainerStyle={{ paddingBottom: bottomInset }}
      data={rows}
      // Rows wrap to variable heights, so no getItemLayout: the window is measured. These
      // batch sizes keep a thousand-line diff scrolling without blocking the JS thread.
      initialNumToRender={40}
      keyExtractor={(row) => row.key}
      maxToRenderPerBatch={40}
      renderItem={({ item }) => <DiffRowView ctx={ctx} row={item} />}
      testID="porcelain-changes-diff-rows"
      windowSize={9}
    />
  )
}
