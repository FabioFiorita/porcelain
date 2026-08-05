import type { TokenMap } from '@porcelain/client-runtime/highlight'
import { fileName } from '@porcelain/client-runtime/paths'
import { intraLineEmphasis } from '@porcelain/client-runtime/word-diff-line'
import { useMemo, useState } from 'react'
import { FlatList, Text, View } from 'react-native'

import { usePreferencesStore } from '@/features/settings/preferences-store'
import type { DiffHunk, FeatureReading } from '@/lib/daemon/procedures/changes'
import { cn } from '@/lib/utils'

import { EmptyNote, ErrorNote, IconAction, PanelLabel } from './changes-chrome'
import type { ChangesScope } from './changes-store'
import { type CommentAnchor, CommentComposer } from './comment-composer'
import { DiffRowView } from './diff-lines'
import { anchorTextFor, rangeForPath, rangeOf } from './line-selection'
import { type ReadingRow, toReadingRows } from './reading-rows'
import { SelectionBar } from './selection-bar'
import { useDiffReading, useReviewedPaths, useToggleReviewed } from './use-changes'
import { useCommentedLinesByPath, useReviewComments } from './use-comments'
import { useDiffTokens } from './use-highlight'
import { type LineSelectionControls, useLineSelection } from './use-line-selection'

/**
 * The whole change set as one scrollable document — "read all". Same flow order as the list,
 * every file's diff inlined, so a review can be walked end to end without returning to the
 * list between files.
 */
export function ReadAllView({
  active,
  base,
  bottomInset = 0,
  scope,
  onBack,
  topInset = 0,
}: {
  active: boolean
  base: string | undefined
  /** Phone: room for the floating tab bar the rows scroll under. */
  bottomInset?: number
  scope: ChangesScope
  onBack?: () => void
  /** Phone: this view replaces the tab header, so it owns the status-bar inset. */
  topInset?: number
}): React.JSX.Element {
  const { error, isLoading, reading } = useDiffReading(scope, active)
  const mode = usePreferencesStore((state) => state.diffMode)
  const reviewed = useReviewedPaths(active)
  const { mark, unmark } = useToggleReviewed()
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
  const scopeLabel = scope === 'branch' ? `Branch range · vs ${base ?? 'base'}` : 'Working tree'

  return (
    <View className="flex-1 bg-background" testID="porcelain-changes-read-all">
      <View
        className="flex-row items-center gap-1 border-b border-border px-2 py-1.5"
        style={{ paddingTop: topInset + 6 }}
      >
        {onBack === undefined ? null : (
          <IconAction
            accessibilityLabel="Back to changes"
            glyph="chevronLeft"
            testID="porcelain-changes-read-all-back"
            tone="foreground"
            onPress={onBack}
          />
        )}
        <View className={cn('min-w-0 flex-1', onBack === undefined && 'pl-1.5')}>
          <Text className="text-xs font-semibold text-foreground">All changes</Text>
          <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
            {scopeLabel} · {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </Text>
        </View>
      </View>

      {error !== null ? (
        <View className="p-4">
          <ErrorNote message={error.message} testID="porcelain-changes-read-all-error" />
        </View>
      ) : isLoading ? (
        <Text
          className="p-4 text-sm text-muted-foreground"
          testID="porcelain-changes-read-all-loading"
        >
          Loading…
        </Text>
      ) : fileCount === 0 ? (
        <EmptyNote
          body="Nothing to walk through in this range yet."
          testID="porcelain-changes-read-all-empty"
          title="No changes to review"
        />
      ) : (
        <FlatList
          contentContainerStyle={{ paddingBottom: bottomInset }}
          data={rows}
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
              tokensFor={diffTokens}
              isReviewed={item.kind === 'file' ? reviewed.has(item.file.path) : false}
              row={item}
              onToggleCollapsed={toggleCollapsed}
              onToggleReviewed={(path, next) => {
                if (next) {
                  mark(path)
                  // Ticking a file off folds it away, like the web surface: the read moves on
                  // to the next file instead of leaving a wall of already-read diff behind.
                  setCollapsed((current) => new Set(current).add(path))
                } else {
                  unmark(path)
                }
              }}
            />
          )}
          testID="porcelain-changes-read-all-rows"
          windowSize={9}
        />
      )}

      {activeSelection === null ? null : (
        <SelectionBar
          bottomInset={bottomInset}
          path={activeSelection.path}
          range={activeSelection.range}
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
  row,
  selection,
  tokensFor,
}: {
  collapsed: boolean
  commentedByPath: Map<string, Set<number>>
  emphasis: React.ComponentProps<typeof DiffRowView>['ctx']['emphasis']
  hunksByPath: Map<string, DiffHunk[]>
  isReviewed: boolean
  onToggleCollapsed: (path: string) => void
  onToggleReviewed: (path: string, reviewed: boolean) => void
  row: ReadingRow
  selection: LineSelectionControls
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
          testID={`porcelain-changes-read-all-collapse-${fileName(file.path)}`}
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
        <IconAction
          accessibilityLabel={`${isReviewed ? 'Unmark' : 'Mark'} ${fileName(file.path)} reviewed`}
          glyph={isReviewed ? 'squareCheck' : 'square'}
          selected={isReviewed}
          testID={`porcelain-changes-read-all-reviewed-${fileName(file.path)}`}
          tone={isReviewed ? 'success' : 'muted'}
          onPress={() => {
            onToggleReviewed(file.path, !isReviewed)
          }}
        />
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
