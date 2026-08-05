import { fileName } from '@porcelain/client-runtime/paths'
import { useMemo, useState } from 'react'
import { FlatList, Image, Text, View } from 'react-native'

import { EmptyNote, ErrorNote, IconAction } from '@/components/panel-chrome'
import { type CommentAnchor, CommentComposer } from '@/features/comments/comment-composer'
import { rangeForPath } from '@/features/comments/line-range'
import { SelectionBar } from '@/features/comments/selection-bar'
import { useCommentIndex, useReviewComments } from '@/features/comments/use-comments'
import { useLineSelection } from '@/features/comments/use-line-selection'
import type { FileView } from '@/lib/daemon/procedures/files'
import { cn } from '@/lib/utils'

import { pathTestId } from './file-paths'
import { SourceLine } from './source-lines'
import { describeBytes, type SourceRow, sourceAnchorText, toSourceRows } from './source-rows'
import { useSourceTokens } from './use-file-highlight'
import { useFileContents, usePathScope, usePinnedEntries } from './use-files'

/**
 * One file, whole — the Files tab's viewer.
 *
 * The same reading surface as the diff, minus the diff: syntax colour from the same VS Code
 * theme, the same gutter, the same long-press-then-tap line selection, and the same composer
 * on the other end of it. That last part is the point of reading a file on a phone at all —
 * a comment filed here reaches the agent through the same channel as one filed on a diff.
 *
 * Markdown and HTML render as source. The desktop's reader and sandboxed preview both need a
 * renderer this client does not carry (a WebView, a markdown component), and adding one is a
 * native dependency decision, not a detail of this tab.
 */
export function FileViewer({
  active,
  bottomInset = 0,
  filePath,
  onBack,
  topInset = 0,
}: {
  active: boolean
  /** Phone: room for the floating tab bar the rows scroll under. */
  bottomInset?: number
  /** Repo-relative. */
  filePath: string
  /** Phone: pop back to the browser. Omitted on tablet, where the list is always on screen. */
  onBack?: () => void
  /** Phone: this view replaces the tab header, so it owns the status-bar inset. */
  topInset?: number
}): React.JSX.Element {
  const { error, isLoading, view } = useFileContents(filePath, active)
  const comments = useReviewComments(active)
  const commentIndex = useCommentIndex(comments, filePath)
  const [anchor, setAnchor] = useState<CommentAnchor | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const lineSelection = useLineSelection()
  const { pin, unpin } = usePathScope()
  // Shares the companion's cache entry, so the header can offer the right half of the toggle
  // instead of a pin button that silently does nothing on an already-pinned file.
  const { entries: pinned } = usePinnedEntries(active)
  const isPinned = pinned.some((entry) => entry.path === filePath)

  const content = view?.type === 'text' ? view.content : ''
  const rows = useMemo(() => toSourceRows(content), [content])
  const tokens = useSourceTokens(filePath, content)
  const commentedLines = useMemo(() => new Set(commentIndex.byLine.keys()), [commentIndex])
  const selected = rangeForPath(lineSelection.selection, filePath)
  const { extend, start } = lineSelection
  const ctx = useMemo(
    () => ({
      commentedLines,
      onAnchorLine: (line: number): void => {
        start(filePath, line)
      },
      onExtendToLine: (line: number): void => {
        extend(filePath, line)
      },
      selected,
      tokens,
    }),
    [commentedLines, extend, filePath, selected, start, tokens],
  )

  const handleCommentSelection = (): void => {
    if (selected === null) return
    setAnchor({
      anchorText: sourceAnchorText(rows, selected),
      endLine: selected.endLine,
      path: filePath,
      startLine: selected.startLine,
    })
    lineSelection.clear()
  }

  // A pin is a daemon write that can fail (a vanished path, a read-only scope file); say so
  // rather than letting the tap look like it worked.
  const handlePin = (next: boolean): void => {
    setActionError(null)
    ;(next ? pin(filePath) : unpin(filePath)).catch((cause: unknown) => {
      setActionError(
        `${next ? 'Pin' : 'Unpin'} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      )
    })
  }

  return (
    <View className="flex-1 bg-background" testID="porcelain-files-viewer">
      <ViewerHeader
        commentCount={commentIndex.fileLevel.length + commentIndex.byLine.size}
        filePath={filePath}
        isPinned={isPinned}
        onBack={onBack}
        onComment={() => {
          setAnchor({ path: filePath })
        }}
        onTogglePinned={() => {
          handlePin(!isPinned)
        }}
        topInset={topInset}
      />

      {actionError === null ? null : (
        <View className="px-3 py-2">
          <ErrorNote message={actionError} testID="porcelain-files-viewer-action-error" />
        </View>
      )}

      <ViewerBody
        bottomInset={bottomInset}
        ctx={ctx}
        error={error}
        filePath={filePath}
        isLoading={isLoading}
        rows={rows}
        view={view}
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

function ViewerHeader({
  commentCount,
  filePath,
  isPinned,
  onBack,
  onComment,
  onTogglePinned,
  topInset,
}: {
  commentCount: number
  filePath: string
  isPinned: boolean
  onBack?: () => void
  onComment: () => void
  onTogglePinned: () => void
  topInset: number
}): React.JSX.Element {
  return (
    <View
      className="flex-row items-center gap-1 border-b border-border px-2 py-1.5"
      style={{ paddingTop: topInset + 6 }}
    >
      {onBack === undefined ? null : (
        <IconAction
          accessibilityLabel="Back to files"
          glyph="chevronLeft"
          testID="porcelain-files-viewer-back"
          tone="foreground"
          onPress={onBack}
        />
      )}
      <View className={cn('min-w-0 flex-1', onBack === undefined && 'pl-1.5')}>
        <Text className="font-mono text-xs font-medium text-foreground" numberOfLines={1}>
          {fileName(filePath)}
        </Text>
        {/* Head-truncated: the tail of a path identifies it, the repo root never does. */}
        <Text
          className="font-mono text-[10px] text-muted-foreground"
          ellipsizeMode="head"
          numberOfLines={1}
        >
          {filePath}
          {commentCount === 0 ? '' : ` · ${commentCount} commented`}
        </Text>
      </View>
      <IconAction
        accessibilityLabel={isPinned ? 'Unpin file' : 'Pin file'}
        glyph={isPinned ? 'pinOff' : 'pin'}
        selected={isPinned}
        testID="porcelain-files-viewer-pin"
        tone={isPinned ? 'primary' : 'muted'}
        onPress={onTogglePinned}
      />
      <IconAction
        accessibilityLabel="Comment on file"
        glyph="commentAdd"
        testID="porcelain-files-viewer-comment"
        onPress={onComment}
      />
    </View>
  )
}

function ViewerBody({
  bottomInset,
  ctx,
  error,
  filePath,
  isLoading,
  rows,
  view,
}: {
  bottomInset: number
  ctx: React.ComponentProps<typeof SourceLine>['ctx']
  error: Error | null
  filePath: string
  isLoading: boolean
  rows: SourceRow[]
  view: FileView | undefined
}): React.JSX.Element {
  if (error !== null) {
    return (
      <View className="p-4">
        <ErrorNote message={error.message} testID="porcelain-files-viewer-error" />
      </View>
    )
  }
  if (view === undefined && isLoading) {
    return (
      <Text className="p-4 text-sm text-muted-foreground" testID="porcelain-files-viewer-loading">
        Loading…
      </Text>
    )
  }
  if (view === undefined) {
    return (
      <EmptyNote
        body="The daemon returned nothing for this path."
        testID="porcelain-files-viewer-unavailable"
        title="Nothing to show"
      />
    )
  }
  if (view.type === 'not-found') {
    return (
      <EmptyNote
        body="It was deleted or moved on the host since this list was read."
        testID="porcelain-files-viewer-missing"
        title="This file no longer exists"
      />
    )
  }
  if (view.type === 'image') {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Image
          accessibilityLabel={fileName(filePath)}
          className="h-4/5 w-full"
          resizeMode="contain"
          source={{ uri: view.dataUrl }}
          testID="porcelain-files-viewer-image"
        />
      </View>
    )
  }
  if (view.type === 'binary') {
    return (
      <EmptyNote
        body={`${describeBytes(view.size)} of binary content — Porcelain doesn’t render bytes.`}
        testID="porcelain-files-viewer-binary"
        title="Binary file"
      />
    )
  }
  if (view.type === 'too-large') {
    return (
      <EmptyNote
        body={`${describeBytes(view.size)} is past the read limit — open this one on the host.`}
        testID="porcelain-files-viewer-too-large"
        title="File too large to preview"
      />
    )
  }
  if (rows.length === 0) {
    return (
      <EmptyNote
        body="Nothing has been written to it yet."
        testID="porcelain-files-viewer-empty"
        title="Empty file"
      />
    )
  }
  return (
    <FlatList
      contentContainerStyle={{ paddingBottom: bottomInset }}
      data={rows}
      // Lines wrap to variable heights, so no getItemLayout: the window is measured. These
      // batch sizes keep a thousand-line file scrolling without blocking the JS thread.
      initialNumToRender={40}
      keyExtractor={(row) => row.key}
      maxToRenderPerBatch={40}
      renderItem={({ item }) => <SourceLine ctx={ctx} row={item} />}
      testID={pathTestId('porcelain-files-source', filePath)}
      windowSize={9}
    />
  )
}
