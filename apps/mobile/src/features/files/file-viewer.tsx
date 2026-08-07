import { fileName } from '@porcelain/client-runtime/paths'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Image, Text, View } from 'react-native'
import { EmptyNote, ErrorNote, IconAction } from '@/components/panel-chrome'
import { SegmentedControl } from '@/components/segmented-control'
import { type CommentAnchor, CommentComposer } from '@/features/comments/comment-composer'
import { describeRange, type LineRange, rangeForPath } from '@/features/comments/line-range'
import { SelectionBar } from '@/features/comments/selection-bar'
import { useCommentIndex, useReviewComments } from '@/features/comments/use-comments'
import { useLineSelection } from '@/features/comments/use-line-selection'
import {
  type HtmlMode,
  type MarkdownMode,
  usePreferencesStore,
} from '@/features/settings/preferences-store'
import { useResolvedColorScheme } from '@/features/settings/theme-provider'
import type { FileView } from '@/lib/daemon/procedures/files'
import { cn } from '@/lib/utils'

import { isHtmlPath, isMarkdownPath } from './file-kinds'
import { pathTestId } from './file-paths'
import { markdownToHtml, previewDocument, readerDocument } from './preview-document'
import { PreviewView } from './preview-view'
import { SourceLine } from './source-lines'
import { describeBytes, type SourceRow, sourceAnchorText, toSourceRows } from './source-rows'
import { useSourceTokens } from './use-file-highlight'
import { useFileContents, useHtmlPreview, usePathScope, usePinnedEntries } from './use-files'
import { type ViewerOverride, viewerMode } from './viewer-mode'

/**
 * One file, whole — the Files tab's viewer.
 *
 * The same reading surface as the diff, minus the diff: syntax colour from the same VS Code
 * theme, the same gutter, the same long-press-then-tap line selection, and the same composer
 * on the other end of it. That last part is the point of reading a file on a phone at all —
 * a comment filed here reaches the agent through the same channel as one filed on a diff.
 *
 * A markdown or HTML file also has a rendered face. Which one it opens in is the Settings
 * preference; the toggle above the content overrides that choice **for this file only** and
 * never writes back to the default — see `viewer-mode.ts`. Source stays the surface that
 * carries line numbers, comment markers and selection — a comment anchors to a line, and a
 * rendered page has none.
 */
export function FileViewer({
  active,
  bottomInset = 0,
  filePath,
  line,
  onBack,
  topInset = 0,
}: {
  active: boolean
  /** Phone: room for the floating tab bar the rows scroll under. */
  bottomInset?: number
  /** Repo-relative. */
  filePath: string
  /** 1-based line to scroll to and tint — a search hit, opened where it matched. */
  line?: number
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

  const markdown = isMarkdownPath(filePath)
  const html = isHtmlPath(filePath)
  // The Settings row is the default a file opens in; the toggle below is this file's override.
  // They were one field, which is why glancing at a README's source used to make Source the
  // app-wide default for every markdown file afterwards.
  const defaultMarkdownMode = usePreferencesStore((state) => state.markdownMode)
  const defaultHtmlMode = usePreferencesStore((state) => state.htmlMode)
  const [markdownOverride, setMarkdownOverride] = useState<ViewerOverride<MarkdownMode> | null>(
    null,
  )
  const [htmlOverride, setHtmlOverride] = useState<ViewerOverride<HtmlMode> | null>(null)
  const markdownMode = viewerMode(defaultMarkdownMode, markdownOverride, filePath)
  const htmlMode = viewerMode(defaultHtmlMode, htmlOverride, filePath)
  const scheme = useResolvedColorScheme()
  // A rendered face only exists for a text file that has one; an image or a binary is neither.
  const isText = view?.type === 'text'
  const reader = isText && markdown && markdownMode === 'reader'
  const preview = isText && html && htmlMode === 'preview'
  // The daemon re-reads the file to inline its images, so only ask while the preview is up.
  const htmlPreview = useHtmlPreview(filePath, active && preview)

  const content = view?.type === 'text' ? view.content : ''
  const rows = useMemo(() => toSourceRows(content), [content])
  const tokens = useSourceTokens(filePath, content)
  const commentedLines = useMemo(() => new Set(commentIndex.byLine.keys()), [commentIndex])
  const selected = rangeForPath(lineSelection.selection, filePath)
  const { extend, start } = lineSelection
  const ctx = useMemo(
    () => ({
      commentedLines,
      // The line a search hit pointed at, tinted so the reader lands on it rather than
      // somewhere near it. Distinct from `selected`, which is a comment anchor in progress.
      focusedLine: line ?? null,
      onAnchorLine: (at: number): void => {
        start(filePath, at)
      },
      onExtendToLine: (at: number): void => {
        extend(filePath, at)
      },
      selected,
      testIDPrefix: pathTestId('porcelain-files-source-line', filePath),
      tokens,
    }),
    [commentedLines, extend, filePath, line, selected, start, tokens],
  )

  // A range selected in Source means nothing while a rendered page is up — the bar is hidden
  // there for the same reason — so the header falls back to the whole file.
  const anchorable = selected === null || reader || preview ? null : selected

  const handleCommentSelection = (): void => {
    if (anchorable === null) return
    setAnchor({
      anchorText: sourceAnchorText(rows, anchorable),
      endLine: anchorable.endLine,
      path: filePath,
      startLine: anchorable.startLine,
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
        // One button, two anchors: with a range open it files against the range, and against
        // the file when there is none. The bar stays the deliberate route; this is the same
        // action where the reader's thumb already is.
        selectedRange={anchorable}
        onComment={() => {
          if (anchorable === null) setAnchor({ path: filePath })
          else handleCommentSelection()
        }}
        onTogglePinned={() => {
          handlePin(!isPinned)
        }}
        topInset={topInset}
      />

      {actionError === null ? null : (
        <View className="px-4 py-2">
          <ErrorNote message={actionError} testID="porcelain-files-viewer-action-error" />
        </View>
      )}

      {!isText || (!markdown && !html) ? null : (
        <View className="px-4 py-2">
          {markdown ? (
            <SegmentedControl<MarkdownMode>
              options={[
                { value: 'reader', label: 'Reader', testID: 'porcelain-files-mode-reader' },
                { value: 'source', label: 'Source', testID: 'porcelain-files-mode-source' },
              ]}
              testID="porcelain-files-markdown-mode"
              value={markdownMode}
              onChange={(mode) => {
                setMarkdownOverride({ mode, path: filePath })
              }}
            />
          ) : (
            <SegmentedControl<HtmlMode>
              options={[
                { value: 'preview', label: 'Preview', testID: 'porcelain-files-mode-preview' },
                { value: 'source', label: 'Source', testID: 'porcelain-files-mode-html-source' },
              ]}
              testID="porcelain-files-html-mode"
              value={htmlMode}
              onChange={(mode) => {
                setHtmlOverride({ mode, path: filePath })
              }}
            />
          )}
        </View>
      )}

      {reader ? (
        <PreviewView
          document={readerDocument(markdownToHtml(content), scheme)}
          testID="porcelain-files-reader"
        />
      ) : preview ? (
        <HtmlPreviewBody
          error={htmlPreview.error}
          html={htmlPreview.html}
          isLoading={htmlPreview.isLoading}
        />
      ) : (
        <ViewerBody
          bottomInset={bottomInset}
          ctx={ctx}
          error={error}
          filePath={filePath}
          isLoading={isLoading}
          line={line}
          rows={rows}
          view={view}
        />
      )}

      {/* A rendered page has no line numbers, so a range selected in Source has nothing to
          point at here — the bar waits for the toggle to come back rather than hovering over
          content it cannot describe. */}
      {selected === null || reader || preview ? null : (
        <SelectionBar
          bottomInset={bottomInset}
          path={filePath}
          range={selected}
          testIDPrefix="porcelain-files-selection"
          onCancel={lineSelection.clear}
          onComment={handleCommentSelection}
        />
      )}
      <CommentComposer
        anchor={anchor}
        testIDPrefix="porcelain-files-comment"
        onClose={() => {
          setAnchor(null)
        }}
      />
    </View>
  )
}

/**
 * The preview half of an HTML file. The daemon answers `null` when it declines to prepare the
 * page — missing, empty, or past the read cap — which is a state, not a failure, and the way
 * out of it is the Source toggle that is already on screen.
 */
function HtmlPreviewBody({
  error,
  html,
  isLoading,
}: {
  error: Error | null
  html: string | null | undefined
  isLoading: boolean
}): React.JSX.Element {
  if (error !== null) {
    return (
      <View className="p-4">
        <ErrorNote message={error.message} testID="porcelain-files-preview-error" />
      </View>
    )
  }
  if (html === undefined && isLoading) {
    return (
      <Text className="p-4 text-sm text-muted-foreground" testID="porcelain-files-preview-loading">
        Preparing preview…
      </Text>
    )
  }
  if (html === null || html === undefined) {
    return (
      <EmptyNote
        body="The daemon could not prepare this page — it may be empty or past the read limit. Switch to Source for the raw file."
        testID="porcelain-files-preview-unavailable"
        title="No preview"
      />
    )
  }
  return <PreviewView document={previewDocument(html)} testID="porcelain-files-preview" />
}

function ViewerHeader({
  commentCount,
  filePath,
  isPinned,
  onBack,
  onComment,
  onTogglePinned,
  selectedRange,
  topInset,
}: {
  commentCount: number
  filePath: string
  isPinned: boolean
  onBack?: () => void
  onComment: () => void
  onTogglePinned: () => void
  /** The open selection the comment action would anchor to, or null for the whole file. */
  selectedRange: LineRange | null
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
        accessibilityLabel={
          selectedRange === null
            ? 'Comment on file'
            : `Comment on ${describeRange(selectedRange).toLowerCase()}`
        }
        glyph="commentAdd"
        selected={selectedRange !== null}
        testID="porcelain-files-viewer-comment"
        tone={selectedRange === null ? 'muted' : 'primary'}
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
  line,
  rows,
  view,
}: {
  bottomInset: number
  ctx: React.ComponentProps<typeof SourceLine>['ctx']
  error: Error | null
  filePath: string
  isLoading: boolean
  /** 1-based line the caller wants on screen, or undefined to open at the top. */
  line: number | undefined
  rows: SourceRow[]
  view: FileView | undefined
}): React.JSX.Element {
  const listRef = useRef<FlatList<SourceRow>>(null)
  // Hooks run before the early returns below, so the ref stays honest about which line has
  // already been jumped to when the file's contents arrive a beat after the route does.
  const jumped = useRef<string | null>(null)
  const target =
    line === undefined || rows.length === 0
      ? null
      : Math.min(Math.max(Math.trunc(line) - 1, 0), rows.length - 1)

  useEffect(() => {
    const key = `${filePath}:${String(target)}`
    if (target === null || jumped.current === key) return
    jumped.current = key
    // The list is measured, not laid out from a known row height, so the first frame after
    // mount has no offset for a row deep in the file; `onScrollToIndexFailed` finishes the job.
    listRef.current?.scrollToIndex({ animated: false, index: target, viewPosition: 0.3 })
  }, [filePath, target])

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
      ref={listRef}
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
      // A hit past the first window has no measured offset yet. Land on the estimate, which
      // renders the rows in between, then ask once more for the exact row. One retry only:
      // a loop here would fight the user's own scrolling.
      onScrollToIndexFailed={(info) => {
        listRef.current?.scrollToOffset({
          animated: false,
          offset: info.averageItemLength * info.index,
        })
        setTimeout(() => {
          listRef.current?.scrollToIndex({
            animated: false,
            index: Math.min(info.index, rows.length - 1),
            viewPosition: 0.3,
          })
        }, 120)
      }}
    />
  )
}
