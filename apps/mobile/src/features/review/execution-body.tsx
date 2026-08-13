import type { TokenMap } from '@porcelain/client-runtime/highlight'
import { fileName } from '@porcelain/client-runtime/paths'
import { intraLineEmphasis } from '@porcelain/client-runtime/word-diff-line'
import type { DiffHunk } from '@porcelain/contracts/git'
import type { ReadingFile, ReviewReading, SliceRange } from '@porcelain/contracts/review'
import { useEffect, useMemo, useRef, useState } from 'react'
import { type FlatList, Text, View } from 'react-native'
import type { ThemedToken } from 'shiki'
import { EmptyNote, IconAction, PanelLabel } from '@/components/panel-chrome'
import { SurfaceList } from '@/components/surface-scroll'
import { useReviewedPaths, useToggleReviewed } from '@/features/changes/use-changes'
import {
  type CommentAnchor,
  CommentComposer,
  rangeForPath,
  rangeOf,
  SelectionBar,
  useCommentedLinesByPath,
  useLineSelection,
  useReviewComments,
} from '@/features/comments'
import { DiffRowView } from '@/features/diff/diff-lines'
import { anchorTextFor } from '@/features/diff/diff-rows'
import { StatusBadge } from '@/features/diff/status-badge'
import { useDiffTokens } from '@/features/diff/use-highlight'
import { pathTestId, SourceLine, type SourceRow, sourceAnchorText } from '@/features/files'
import { usePreferencesStore } from '@/features/settings/preferences-store'
import { useBottomChrome } from '@/features/shell/bottom-chrome'
import { cn } from '@/lib/utils'
import { blockRowIndex, type ExecutionRow, toExecutionRows } from './execution-rows'
import { FileNote, GapRow, SourceMarker } from './review-chrome'
import { useReviewStore } from './review-store'
import { useSliceTokens } from './use-slice-tokens'

const NO_COMMENTS: ReadonlySet<number> = new Set()
const NO_HUNKS: readonly DiffHunk[] = []
const NO_RANGES: readonly SliceRange[] = []

/**
 * Execution: the Review's files, read as one document.
 *
 * The half of the Review the phone is actually good at. A changed file shows its diff, and a
 * context or shipped file shows the symbol slices the daemon decided were worth reading —
 * with the elided lines drawn rather than closed over, because two ranges presented as
 * adjacent code is a lie about the file.
 *
 * Reviewing happens here too: a file's header carries its tick, and a long press anchors the
 * same line selection the diff and file viewers use, so a note filed while reading reaches the
 * agent through the channel it already watches.
 */
export function ExecutionBody({
  active,
  reading,
}: {
  active: boolean
  reading: ReviewReading
}): React.JSX.Element {
  const bottomInset = useBottomChrome()
  const mode = usePreferencesStore((state) => state.diffMode)
  const comments = useReviewComments(active)
  const reviewed = useReviewedPaths(active)
  const { setReviewed } = useToggleReviewed()
  const [anchor, setAnchor] = useState<CommentAnchor | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const lineSelection = useLineSelection()
  const listRef = useRef<FlatList<ExecutionRow>>(null)

  const rows = useMemo(() => toExecutionRows(reading, mode, collapsed), [collapsed, mode, reading])
  // Emphasis is keyed by line identity, so it is computed once over every hunk in the Review
  // rather than per file — the same map serves every row the list renders.
  const emphasis = useMemo(() => intraLineEmphasis(allHunks(reading)), [reading])
  const commentedByPath = useCommentedLinesByPath(comments)
  const diffTokens = useDiffTokens()
  const sliceTokens = useSliceTokens()

  // Bodies per file, so a row can ask for its own file's tokens without walking the Review.
  const bodies = useMemo(() => bodiesByPath(reading), [reading])

  const focus = useReviewStore((state) => state.executionFocus)
  const clearFocus = useReviewStore((state) => state.clearExecutionFocus)
  useEffect(() => {
    if (focus === null) return
    clearFocus()
    const index = blockRowIndex(rows, focus.blockId)
    if (index < 0) return
    listRef.current?.scrollToIndex({ animated: true, index, viewPosition: 0 })
  }, [clearFocus, focus, rows])

  const toggleCollapsed = (path: string): void => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (!next.delete(path)) next.add(path)
      return next
    })
  }

  // The bar names the file too: in a stacked document the range alone would not say which one.
  const activeSelection =
    lineSelection.selection === null
      ? null
      : { path: lineSelection.selection.path, range: rangeOf(lineSelection.selection) }

  const handleCommentSelection = (): void => {
    if (activeSelection === null) return
    const body = bodies.get(activeSelection.path)
    setAnchor({
      anchorText:
        body?.hunks !== undefined
          ? anchorTextFor(body.hunks, activeSelection.range)
          : sourceAnchorText(sourceRowsOf(body?.ranges ?? NO_RANGES), activeSelection.range),
      endLine: activeSelection.range.endLine,
      path: activeSelection.path,
      startLine: activeSelection.range.startLine,
    })
    lineSelection.clear()
  }

  if (rows.length === 0) {
    return (
      <EmptyNote
        body="No files in this Review yet. The agent lists them with review set --files."
        testID="porcelain-review-execution-empty"
        title="Execution is still thin"
      />
    )
  }

  return (
    <View className="flex-1" testID="porcelain-review-execution">
      <SurfaceList
        data={rows}
        edgeToEdge
        // Lines wrap to variable heights, so no getItemLayout: the window is measured. A
        // failed jump falls back to the list's own running average rather than giving up.
        initialNumToRender={40}
        keyExtractor={(row) => row.key}
        maxToRenderPerBatch={40}
        onScrollToIndexFailed={({ averageItemLength, index }) => {
          listRef.current?.scrollToOffset({ animated: true, offset: index * averageItemLength })
        }}
        ref={listRef}
        renderItem={({ item }) => (
          <ExecutionRowView
            collapsed={item.kind === 'file' && collapsed.has(item.file.path)}
            commentedByPath={commentedByPath}
            diffTokensFor={diffTokens}
            emphasis={emphasis}
            bodies={bodies}
            isReviewed={item.kind === 'file' && reviewed.has(item.file.path)}
            row={item}
            selection={lineSelection}
            sliceTokensFor={sliceTokens}
            onToggleCollapsed={toggleCollapsed}
            onToggleReviewed={(path, next) => {
              // setReviewed is total void (React Query owns error + pending).
              setReviewed([path], next)
              // Ticking a file off folds it away, like the continuous read: the document
              // moves on instead of leaving a wall of already-read code behind.
              if (next) setCollapsed((current) => new Set(current).add(path))
            }}
          />
        )}
        testID="porcelain-review-execution-rows"
        windowSize={9}
      />

      {activeSelection === null ? null : (
        <SelectionBar
          bottomInset={bottomInset}
          path={activeSelection.path}
          range={activeSelection.range}
          testIDPrefix="porcelain-review-selection"
          onCancel={lineSelection.clear}
          onComment={handleCommentSelection}
        />
      )}
      <CommentComposer
        anchor={anchor}
        testIDPrefix="porcelain-review-comment"
        onClose={() => {
          setAnchor(null)
        }}
      />
    </View>
  )
}

/** A file's readable body — one of the two shapes, never both. */
type FileBody = { hunks?: readonly DiffHunk[]; ranges?: readonly SliceRange[] }

function bodiesByPath(reading: ReviewReading): Map<string, FileBody> {
  const bodies = new Map<string, FileBody>()
  for (const file of [
    ...reading.sections.flatMap((section) => section.files),
    ...reading.groups.flatMap((group) => group.files),
  ]) {
    if (bodies.has(file.path)) continue
    bodies.set(file.path, { hunks: file.hunks, ranges: file.ranges })
  }
  return bodies
}

function allHunks(reading: ReviewReading): DiffHunk[] {
  return [
    ...reading.sections.flatMap((section) => section.files),
    ...reading.groups.flatMap((group) => group.files),
  ].flatMap((file) => file.hunks ?? [])
}

/** The slice lines as numbered rows — what quoting a selection out of them needs. */
function sourceRowsOf(ranges: readonly SliceRange[]): SourceRow[] {
  const rows: SourceRow[] = []
  for (const range of ranges) {
    range.lines.forEach((text, offset) => {
      const line = range.startLine + offset
      rows.push({ key: String(line), line, text })
    })
  }
  return rows
}

function ExecutionRowView({
  bodies,
  collapsed,
  commentedByPath,
  diffTokensFor,
  emphasis,
  isReviewed,
  onToggleCollapsed,
  onToggleReviewed,
  row,
  selection,
  sliceTokensFor,
}: {
  bodies: Map<string, FileBody>
  collapsed: boolean
  commentedByPath: Map<string, Set<number>>
  diffTokensFor: (path: string, hunks: readonly DiffHunk[]) => TokenMap
  emphasis: React.ComponentProps<typeof DiffRowView>['ctx']['emphasis']
  isReviewed: boolean
  onToggleCollapsed: (path: string) => void
  onToggleReviewed: (path: string, reviewed: boolean) => void
  row: ExecutionRow
  selection: ReturnType<typeof useLineSelection>
  sliceTokensFor: (path: string, ranges: readonly SliceRange[]) => ThemedToken[][] | null
}): React.JSX.Element {
  if (row.kind === 'block') {
    return (
      <View className="flex-row items-baseline gap-2 bg-background px-3 pb-1 pt-4">
        <PanelLabel>{row.title}</PanelLabel>
        <Text className="text-3xs text-muted-foreground/70">
          {row.fileCount} {row.fileCount === 1 ? 'file' : 'files'}
        </Text>
      </View>
    )
  }

  if (row.kind === 'file') {
    return (
      <FileHeader
        collapsed={collapsed}
        file={row.file}
        isReviewed={isReviewed}
        onToggleCollapsed={onToggleCollapsed}
        onToggleReviewed={onToggleReviewed}
      />
    )
  }

  if (row.kind === 'note') {
    return <FileNote note={row.note} testID={pathTestId('porcelain-review-note', row.path)} />
  }

  if (row.kind === 'gap') {
    return <GapRow lines={row.lines} />
  }

  if (row.kind === 'truncated') {
    return (
      <Text className="px-3 py-2 font-mono text-3xs text-muted-foreground">
        Slice capped — more relevant lines exist in this file.
      </Text>
    )
  }

  if (row.kind === 'empty') {
    return (
      <Text
        className="px-3 py-2 font-mono text-2xs text-muted-foreground"
        testID={pathTestId('porcelain-review-no-body', row.path)}
      >
        {row.file.source === 'changed'
          ? 'No line changes'
          : 'No lines to show — the daemon found nothing to slice here.'}
      </Text>
    )
  }

  if (row.kind === 'diff') {
    return (
      <DiffRowView
        ctx={{
          commentedLines: commentedByPath.get(row.path) ?? NO_COMMENTS,
          emphasis,
          onAnchorLine: (line: number): void => {
            selection.start(row.path, line)
          },
          onExtendToLine: (line: number): void => {
            selection.extend(row.path, line)
          },
          selected: rangeForPath(selection.selection, row.path),
          tokens: diffTokensFor(row.path, bodies.get(row.path)?.hunks ?? NO_HUNKS),
        }}
        row={row.row}
      />
    )
  }

  return (
    <SourceLine
      ctx={{
        commentedLines: commentedByPath.get(row.path) ?? NO_COMMENTS,
        // Execution is never opened at a line the way a search hit opens a file — the reader
        // arrives at a block, not a line — so there is nothing to tint as the jump target.
        focusedLine: null,
        onAnchorLine: (line: number): void => {
          selection.start(row.path, line)
        },
        onExtendToLine: (line: number): void => {
          selection.extend(row.path, line)
        },
        selected: rangeForPath(selection.selection, row.path),
        testIDPrefix: pathTestId('porcelain-review-source-line', row.path),
        tokens: sliceTokensFor(row.path, bodies.get(row.path)?.ranges ?? NO_RANGES),
      }}
      row={row.row}
    />
  )
}

function FileHeader({
  collapsed,
  file,
  isReviewed,
  onToggleCollapsed,
  onToggleReviewed,
}: {
  collapsed: boolean
  file: ReadingFile
  isReviewed: boolean
  onToggleCollapsed: (path: string) => void
  onToggleReviewed: (path: string, reviewed: boolean) => void
}): React.JSX.Element {
  const name = fileName(file.path)
  return (
    <View
      className="flex-row items-center gap-2 border-y border-border bg-card px-3 py-2"
      testID={pathTestId('porcelain-review-file', file.path)}
    >
      <IconAction
        accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} ${name}`}
        glyph={collapsed ? 'chevronRight' : 'chevron'}
        testID={pathTestId('porcelain-review-collapse', file.path)}
        onPress={() => {
          onToggleCollapsed(file.path)
        }}
      />
      <SourceMarker source={file.source} />
      {file.status === undefined ? null : <StatusBadge status={file.status} />}
      <View className="min-w-0 flex-1">
        <Text
          className={cn(
            'font-mono text-xs font-medium text-foreground',
            isReviewed && 'text-muted-foreground line-through',
          )}
          numberOfLines={1}
        >
          {name}
        </Text>
        {/* Head-truncated: the tail of a path identifies it, the repo root never does. */}
        <Text
          className="font-mono text-3xs text-muted-foreground"
          ellipsizeMode="head"
          numberOfLines={1}
        >
          {file.path}
        </Text>
      </View>
      {file.additions === undefined ? null : (
        <Text className="font-mono text-3xs text-success">+{file.additions}</Text>
      )}
      {file.deletions === undefined ? null : (
        <Text className="font-mono text-3xs text-destructive">−{file.deletions}</Text>
      )}
      <IconAction
        accessibilityLabel={`${isReviewed ? 'Unmark' : 'Mark'} ${name} reviewed`}
        glyph={isReviewed ? 'squareCheck' : 'square'}
        selected={isReviewed}
        testID={pathTestId('porcelain-review-reviewed', file.path)}
        tone={isReviewed ? 'success' : 'muted'}
        onPress={() => {
          onToggleReviewed(file.path, !isReviewed)
        }}
      />
    </View>
  )
}
