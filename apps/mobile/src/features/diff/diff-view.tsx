import { fileName } from '@porcelain/client-runtime/paths'
import { intraLineEmphasis } from '@porcelain/client-runtime/word-diff-line'
import { useMemo, useState } from 'react'
import { FlatList, Image, Text, View } from 'react-native'
import { EmptyNote, ErrorNote, IconAction } from '@/components/panel-chrome'
import { type CommentAnchor, CommentComposer } from '@/features/comments/comment-composer'
import { useCommentIndex, useReviewComments } from '@/features/comments/use-comments'
import { usePreferencesStore } from '@/features/settings/preferences-store'
import type { DiffHunk, FileStatus } from '@/lib/daemon/procedures/changes'
import { cn } from '@/lib/utils'
import { DiffRowView } from './diff-lines'
import { type DiffRow, toDiffRows } from './diff-rows'
import { anchorTextFor, describeRange, type LineRange, rangeForPath } from './line-selection'
import { SelectionBar } from './selection-bar'
import { type DiffSource, useDiffFile } from './use-diff'
import { useDiffTokens } from './use-highlight'
import { useLineSelection } from './use-line-selection'

/** The reviewed tick, when the surface has one. A historical commit has no reviewed state. */
export type ReviewedControl = { isReviewed: boolean; onToggle: () => void }

/**
 * One file's diff — from the working tree, a branch range, or a single commit.
 *
 * The unified / split choice is a Settings preference rather than a control in this header —
 * a phone has no room for two code columns, and the toggle would be a per-viewer decision the
 * user has already made once.
 */
export function DiffView({
  active,
  bottomInset = 0,
  filePath,
  onBack,
  onOpenFile,
  reviewed,
  source,
  testID,
  commentTestIDPrefix = 'porcelain-changes-comment',
  selectionTestIDPrefix = 'porcelain-changes-selection',
  topInset = 0,
}: {
  active: boolean
  /** Phone: room for the floating tab bar the rows scroll under. */
  bottomInset?: number
  filePath: string
  /** Phone: pop back to the list. Omitted on tablet, where the list is always on screen. */
  onBack?: () => void
  /**
   * Open the whole file in the Files viewer — a push on phone, a viewer-column selection on
   * tablet. The host decides which; the header just offers it.
   */
  onOpenFile?: (path: string) => void
  /** Omitted where reviewing does not apply — a commit's diff is already history. */
  reviewed?: ReviewedControl
  /** Which diff to read. The tab that owns this view decides. */
  source: DiffSource
  /**
   * Root test id. Every control below derives from it (`${testID}-back`, `-rows`, …) so the
   * tabs that share this surface stay separately addressable in the Android tree.
   */
  testID: string
  /** Prefix for the comment controls exposed by this surface. */
  commentTestIDPrefix?: string
  /** Prefix for the selection-bar controls exposed by this surface. */
  selectionTestIDPrefix?: string
  /** Phone: this view replaces the tab header, so it owns the status-bar inset. */
  topInset?: number
}): React.JSX.Element {
  const file = useDiffFile(filePath, source, active)
  const preferredMode = usePreferencesStore((state) => state.diffMode)
  const comments = useReviewComments(active)
  const commentIndex = useCommentIndex(comments, filePath)
  const [anchor, setAnchor] = useState<CommentAnchor | null>(null)
  const lineSelection = useLineSelection()

  const hunks: readonly DiffHunk[] = file.hunks ?? []
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
    <View className="flex-1 bg-background" testID={testID}>
      <DiffHeader
        filePath={filePath}
        reviewed={reviewed}
        // One button, two anchors: with a range open it files against the range, and against
        // the file when there is none. The bar stays the deliberate route; this is the same
        // action where the reader's thumb already is.
        selectedRange={selected}
        testID={testID}
        topInset={topInset}
        onBack={onBack}
        onComment={() => {
          if (selected === null) setAnchor({ path: filePath })
          else handleCommentSelection()
        }}
        onOpenFile={onOpenFile}
      />
      <DiffBody
        binary={file.binary}
        bottomInset={bottomInset}
        ctx={ctx}
        error={file.error}
        image={file.image}
        isLoading={file.isLoading}
        rows={rows}
        status={file.status}
        testID={testID}
      />
      {selected === null ? null : (
        <SelectionBar
          bottomInset={bottomInset}
          path={filePath}
          range={selected}
          testIDPrefix={selectionTestIDPrefix}
          onCancel={lineSelection.clear}
          onComment={handleCommentSelection}
        />
      )}
      <CommentComposer
        anchor={anchor}
        testIDPrefix={commentTestIDPrefix}
        onClose={() => {
          setAnchor(null)
        }}
      />
    </View>
  )
}

function DiffHeader({
  filePath,
  onBack,
  onComment,
  onOpenFile,
  reviewed,
  selectedRange,
  testID,
  topInset,
}: {
  filePath: string
  onBack?: () => void
  onComment: () => void
  onOpenFile?: (path: string) => void
  reviewed: ReviewedControl | undefined
  /** The open selection the comment action would anchor to, or null for the whole file. */
  selectedRange: LineRange | null
  testID: string
  topInset: number
}): React.JSX.Element {
  return (
    <View
      className="flex-row items-center gap-1 border-b border-border px-2 py-1.5"
      style={{ paddingTop: topInset + 6 }}
    >
      {onBack === undefined ? null : (
        <IconAction
          accessibilityLabel="Back"
          glyph="chevronLeft"
          testID={`${testID}-back`}
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
      {reviewed === undefined ? null : (
        <IconAction
          accessibilityLabel={reviewed.isReviewed ? 'Unmark reviewed' : 'Mark reviewed'}
          glyph={reviewed.isReviewed ? 'squareCheck' : 'square'}
          selected={reviewed.isReviewed}
          testID={`${testID}-reviewed`}
          tone={reviewed.isReviewed ? 'success' : 'muted'}
          onPress={reviewed.onToggle}
        />
      )}
      <IconAction
        accessibilityLabel={
          selectedRange === null
            ? 'Comment on file'
            : `Comment on ${describeRange(selectedRange).toLowerCase()}`
        }
        glyph="commentAdd"
        selected={selectedRange !== null}
        testID={`${testID}-comment`}
        tone={selectedRange === null ? 'muted' : 'primary'}
        onPress={onComment}
      />
      {/* A diff answers "what changed"; the file answers "what is this now". Reading one
          because of the other is the common move, so it is one tap and not a tab switch. */}
      <IconAction
        accessibilityLabel="Open the whole file"
        disabled={onOpenFile === undefined}
        glyph="file"
        testID={`${testID}-open-file`}
        onPress={() => {
          onOpenFile?.(filePath)
        }}
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
  testID,
}: {
  binary: boolean
  bottomInset: number
  ctx: React.ComponentProps<typeof DiffRowView>['ctx']
  error: Error | null
  image: { dataUrl: string } | undefined
  isLoading: boolean
  rows: DiffRow[]
  status: FileStatus | undefined
  testID: string
}): React.JSX.Element {
  if (error !== null) {
    return (
      <View className="p-4">
        <ErrorNote message={error.message} testID={`${testID}-error`} />
      </View>
    )
  }
  if (isLoading) {
    return (
      <Text className="p-4 text-sm text-muted-foreground" testID={`${testID}-loading`}>
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
        testID={`${testID}-binary`}
        title="Binary file"
      />
    )
  }
  if (rows.length === 0) {
    return (
      <EmptyNote
        body="This file is in the change set but its contents match — a mode or rename change."
        testID={`${testID}-empty`}
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
      testID={`${testID}-rows`}
      windowSize={9}
    />
  )
}
