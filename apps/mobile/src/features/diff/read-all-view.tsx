import type { TokenMap } from '@porcelain/client-runtime/highlight'
import { fileName } from '@porcelain/client-runtime/paths'
import { intraLineEmphasis } from '@porcelain/client-runtime/word-diff-line'
import { useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import {
  EmptyNote,
  ErrorNote,
  IconAction,
  PanelLabel,
  ScreenHeader,
} from '@/components/panel-chrome'
import { SurfaceList } from '@/components/surface-scroll'
import { type CommentAnchor, CommentComposer } from '@/features/comments/comment-composer'
import { rangeForPath, rangeOf } from '@/features/comments/line-range'
import { useCommentedLinesByPath, useReviewComments } from '@/features/comments/use-comments'
import type { LineSelectionControls } from '@/features/comments/use-line-selection'
import { usePreferencesStore } from '@/features/settings/preferences-store'
import { useBottomChrome } from '@/features/shell/bottom-chrome'
import type { DiffHunk, DiffReadingScope, FeatureReading } from '@/lib/daemon/procedures/changes'
import { cn } from '@/lib/utils'
import { DiffRowView } from './diff-lines'
import { anchorTextFor } from './diff-rows'
import { type ReadingRow, toReadingRows } from './reading-rows'
import { SelectionBar } from './selection-bar'
import { useDiffReading } from './use-diff'
import { useDiffTokens } from './use-highlight'
import { useLineSelection } from './use-line-selection'

/** Per-file reviewed ticks, when the surface has them. A commit's files are already history. */
export type ReviewedPaths = {
  paths: ReadonlySet<string>
  onToggle: (path: string, reviewed: boolean) => void
}

/**
 * A whole change set as one scrollable document — "read all". Same flow order as the list it
 * was opened from, every file's diff inlined, so a review can be walked end to end without
 * returning to the list between files.
 *
 * The set is whatever `scope` names: the working tree, the branch range, or one commit.
 */
export function ReadAllView({
  active,
  context,
  onBack,
  reviewed,
  scope,
  testID,
  commentTestIDPrefix = 'porcelain-changes-comment',
  selectionTestIDPrefix = 'porcelain-changes-selection',
  title,
  topInset = 0,
}: {
  active: boolean
  /** Second header line — which set this is, before the file count. */
  context: string
  onBack?: () => void
  /** Omitted where reviewing does not apply. */
  reviewed?: ReviewedPaths
  scope: DiffReadingScope
  /** Root test id; every control below derives from it. */
  testID: string
  /** Prefix for the comment controls exposed by this surface. */
  commentTestIDPrefix?: string
  /** Prefix for the selection-bar controls exposed by this surface. */
  selectionTestIDPrefix?: string
  title: string
  /** Phone: this view replaces the tab header, so it owns the status-bar inset. */
  topInset?: number
}): React.JSX.Element {
  const bottomInset = useBottomChrome()
  const { error, isLoading, reading } = useDiffReading(scope, active)
  const mode = usePreferencesStore((state) => state.diffMode)
  const comments = useReviewComments(active)
  const [anchor, setAnchor] = useState<CommentAnchor | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const lineSelection = useLineSelection()

  const toggleCollapsed = (path: string): void => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (!next.delete(path)) next.add(path)
      return next
    })
  }

  const rows = useMemo(
    () => (reading === undefined ? [] : toReadingRows(reading, mode, collapsed)),
    [collapsed, mode, reading],
  )
  // Emphasis is keyed by line identity, so it is computed once over every hunk in the set
  // rather than per file — the same map serves every row the list renders.
  const emphasis = useMemo(() => intraLineEmphasis(allHunks(reading)), [reading])
  const commentedByPath = useCommentedLinesByPath(comments)
  const diffTokens = useDiffTokens()
  // Hunks per file, so a row can ask the cache for its file's tokens without walking the set.
  const hunksByPath = useMemo(() => {
    const byPath = new Map<string, DiffHunk[]>()
    for (const group of reading?.groups ?? []) {
      for (const file of group.files) byPath.set(file.path, file.hunks ?? [])
    }
    return byPath
  }, [reading])

  // The bar names the file too: in a stacked read the range alone would not say which one.
  const activeSelection =
    lineSelection.selection === null
      ? null
      : {
          path: lineSelection.selection.path,
          range: rangeOf(lineSelection.selection),
        }

  const handleCommentSelection = (): void => {
    if (activeSelection === null) return
    setAnchor({
      anchorText: anchorTextFor(hunksByPath.get(activeSelection.path) ?? [], activeSelection.range),
      endLine: activeSelection.range.endLine,
      path: activeSelection.path,
      startLine: activeSelection.range.startLine,
    })
    lineSelection.clear()
  }

  const fileCount = reading?.groups.reduce((count, group) => count + group.files.length, 0) ?? 0

  return (
    <View className="flex-1 bg-background" testID={testID}>
      <ScreenHeader
        back={
          onBack === undefined
            ? undefined
            : { accessibilityLabel: 'Back', onPress: onBack, testID: `${testID}-back` }
        }
        subtitle={`${context} · ${fileCount} ${fileCount === 1 ? 'file' : 'files'}`}
        title={title}
        topInset={topInset}
      />

      {error !== null ? (
        <View className="p-4">
          <ErrorNote message={error.message} testID={`${testID}-error`} />
        </View>
      ) : isLoading ? (
        <Text className="p-4 text-sm text-muted-foreground" testID={`${testID}-loading`}>
          Loading…
        </Text>
      ) : fileCount === 0 ? (
        <EmptyNote
          body="Nothing to walk through in this range yet."
          testID={`${testID}-empty`}
          title="No changes to review"
        />
      ) : (
        <SurfaceList
          data={rows}
          edgeToEdge
          initialNumToRender={40}
          keyExtractor={(row) => row.key}
          maxToRenderPerBatch={40}
          renderItem={({ item }) => (
            <ReadingRowView
              collapsed={item.kind === 'file' && collapsed.has(item.file.path)}
              commentedByPath={commentedByPath}
              emphasis={emphasis}
              hunksByPath={hunksByPath}
              selection={lineSelection}
              testID={testID}
              tokensFor={diffTokens}
              isReviewed={item.kind === 'file' && reviewed?.paths.has(item.file.path) === true}
              reviewable={reviewed !== undefined}
              row={item}
              onToggleCollapsed={toggleCollapsed}
              onToggleReviewed={(path, next) => {
                reviewed?.onToggle(path, next)
                // Ticking a file off folds it away, like the web surface: the read moves on
                // to the next file instead of leaving a wall of already-read diff behind.
                if (next) setCollapsed((current) => new Set(current).add(path))
              }}
            />
          )}
          testID={`${testID}-rows`}
          windowSize={9}
        />
      )}

      {activeSelection === null ? null : (
        <SelectionBar
          bottomInset={bottomInset}
          path={activeSelection.path}
          range={activeSelection.range}
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

function allHunks(reading: FeatureReading | undefined): DiffHunk[] {
  if (reading === undefined) return []
  return reading.groups.flatMap((group) => group.files.flatMap((file) => file.hunks ?? []))
}

const NO_COMMENTS: ReadonlySet<number> = new Set()

function ReadingRowView({
  collapsed,
  commentedByPath,
  emphasis,
  hunksByPath,
  isReviewed,
  onToggleCollapsed,
  onToggleReviewed,
  reviewable,
  row,
  selection,
  testID,
  tokensFor,
}: {
  collapsed: boolean
  commentedByPath: Map<string, Set<number>>
  emphasis: React.ComponentProps<typeof DiffRowView>['ctx']['emphasis']
  hunksByPath: Map<string, DiffHunk[]>
  isReviewed: boolean
  onToggleCollapsed: (path: string) => void
  onToggleReviewed: (path: string, reviewed: boolean) => void
  reviewable: boolean
  row: ReadingRow
  selection: LineSelectionControls
  testID: string
  tokensFor: (path: string, hunks: readonly DiffHunk[]) => TokenMap
}): React.JSX.Element {
  if (row.kind === 'layer') {
    return (
      <View className="bg-background px-3 pb-1 pt-4">
        <PanelLabel>{row.layer}</PanelLabel>
      </View>
    )
  }
  if (row.kind === 'file') {
    const { file } = row
    return (
      <View className="flex-row items-center gap-2 border-y border-border bg-card px-3 py-2">
        <IconAction
          accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} ${fileName(file.path)} diff`}
          glyph={collapsed ? 'chevronRight' : 'chevron'}
          testID={`${testID}-collapse-${fileName(file.path)}`}
          onPress={() => {
            onToggleCollapsed(file.path)
          }}
        />
        <View className="min-w-0 flex-1">
          <Text
            className={cn(
              'font-mono text-xs font-medium text-foreground',
              isReviewed && 'text-muted-foreground line-through',
            )}
            numberOfLines={1}
          >
            {fileName(file.path)}
          </Text>
          <Text
            className="font-mono text-[10px] text-muted-foreground"
            ellipsizeMode="head"
            numberOfLines={1}
          >
            {file.path}
          </Text>
        </View>
        {file.additions === undefined ? null : (
          <Text className="font-mono text-[10px] text-success">+{file.additions}</Text>
        )}
        {file.deletions === undefined ? null : (
          <Text className="font-mono text-[10px] text-destructive">−{file.deletions}</Text>
        )}
        {reviewable ? (
          <IconAction
            accessibilityLabel={`${isReviewed ? 'Unmark' : 'Mark'} ${fileName(file.path)} reviewed`}
            glyph={isReviewed ? 'squareCheck' : 'square'}
            selected={isReviewed}
            testID={`${testID}-reviewed-${fileName(file.path)}`}
            tone={isReviewed ? 'success' : 'muted'}
            onPress={() => {
              onToggleReviewed(file.path, !isReviewed)
            }}
          />
        ) : null}
      </View>
    )
  }
  if (row.kind === 'no-diff') {
    return (
      <Text className="px-3 py-2 font-mono text-[11px] text-muted-foreground">No line changes</Text>
    )
  }
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
        tokens: tokensFor(row.path, hunksByPath.get(row.path) ?? []),
      }}
      row={row.row}
    />
  )
}
