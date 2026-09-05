import { fileName } from '@porcelain/client-runtime/paths'
import { intraLineEmphasis } from '@porcelain/client-runtime/word-diff-line'
import type { DiffHunk, FileStatus } from '@porcelain/contracts/git'
import { useMemo, useState } from 'react'
import { Image, Text, View } from 'react-native'
import { EmptyNote, ErrorNote, IconAction, ScreenHeader } from '@/components/panel-chrome'
import { SurfaceList } from '@/components/surface-scroll'
import {
  type CommentAnchor,
  CommentComposer,
  describeRange,
  type LineRange,
  rangeForPath,
  SelectionBar,
  useCommentIndex,
  useLineSelection,
  useReviewComments,
} from '@/features/comments'
import { type DiffSource, useDiffFile } from '@/features/git'
import { usePreferencesStore } from '@/features/settings/preferences-store'
import { useBottomChrome } from '@/features/shell/window-chrome'
import { DiffRowView } from './diff-lines'
import { anchorTextFor, type DiffRow, toDiffRows } from './diff-rows'

import { useDiffTokens } from './use-highlight'

// A file with no hunks yet must not hand the memos below a fresh [] each render —
// that identity change re-ran row building, emphasis, and tokenization every time.
const NO_HUNKS: readonly DiffHunk[] = []

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
  filePath,
  onBack,
  onOpenFile,
  reviewed,
  source,
  testID,
  commentTestIDPrefix = 'porcelain-changes-comment',
  selectionTestIDPrefix = 'porcelain-changes-selection',
}: {
  active: boolean
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
}): React.JSX.Element {
  const bottomInset = useBottomChrome()
  const file = useDiffFile(filePath, source, active)
  const preferredMode = usePreferencesStore((state) => state.diffMode)
  const comments = useReviewComments(active)
  const [anchor, setAnchor] = useState<CommentAnchor | null>(null)
  const lineSelection = useLineSelection()
  const commentScope =
    source.kind === 'working'
      ? ({ type: 'working' } as const)
      : source.kind === 'commit'
        ? ({ type: 'commit', hash: source.hash } as const)
        : source.base === undefined
          ? undefined
          : ({ type: 'branch', base: source.base } as const)

  const commentIndex = useCommentIndex(comments, filePath, commentScope)

  const hunks: readonly DiffHunk[] = file.hunks ?? NO_HUNKS
  const rows = useMemo(() => toDiffRows(hunks, preferredMode), [hunks, preferredMode])
  const emphasis = useMemo(() => intraLineEmphasis(hunks), [hunks])
  const isCommented = useMemo(
    () => (line: number, side: 'old' | 'new') =>
      commentIndex.byLine
        .get(line)
        ?.some(
          (comment) =>
            comment.anchor?.kind !== 'file' ||
            comment.anchor.side === undefined ||
            comment.anchor.side === side,
        ) === true,
    [commentIndex],
  )
  const diffTokens = useDiffTokens()
  const tokens = useMemo(() => diffTokens(filePath, hunks), [diffTokens, filePath, hunks])
  const selected = rangeForPath(lineSelection.selection, filePath)
  const { extend, start } = lineSelection
  const ctx = useMemo(
    () => ({
      isCommented,
      emphasis,
      onAnchorLine: (line: number, side: 'old' | 'new'): void => {
        start(filePath, line, side)
      },
      onExtendToLine: (line: number, side: 'old' | 'new'): void => {
        extend(filePath, line, side)
      },
      selected,
      tokens,
    }),
    [emphasis, extend, filePath, isCommented, selected, start, tokens],
  )

  const handleCommentSelection = (): void => {
    if (selected === null) return
    setAnchor({
      anchorText: anchorTextFor(hunks, selected),
      endLine: selected.endLine,
      path: filePath,
      startLine: selected.startLine,
      scope: commentScope,
      side: lineSelection.selection?.side,
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
        onBack={onBack}
        onComment={() => {
          if (selected === null) setAnchor({ path: filePath, scope: commentScope })
          else handleCommentSelection()
        }}
        onOpenFile={onOpenFile}
      />
      <DiffBody
        binary={file.binary}
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
}: {
  filePath: string
  onBack?: () => void
  onComment: () => void
  onOpenFile?: (path: string) => void
  reviewed: ReviewedControl | undefined
  /** The open selection the comment action would anchor to, or null for the whole file. */
  selectedRange: LineRange | null
  testID: string
}): React.JSX.Element {
  return (
    <ScreenHeader
      actions={
        <>
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
        </>
      }
      back={
        onBack === undefined
          ? undefined
          : { accessibilityLabel: 'Back', onPress: onBack, testID: `${testID}-back` }
      }
      mono
      subtitle={filePath}
      subtitleFromEnd
      title={fileName(filePath)}
    />
  )
}

function DiffBody({
  binary,
  ctx,
  error,
  image,
  isLoading,
  rows,
  status,
  testID,
}: {
  binary: boolean
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
        <Text className="text-2xs text-muted-foreground">
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
    <SurfaceList
      data={rows}
      edgeToEdge
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
