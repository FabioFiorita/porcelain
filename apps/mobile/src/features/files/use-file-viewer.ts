import type { FileView } from '@porcelain/contracts/files'
import { useMemo, useState } from 'react'
import type { CommentAnchor, LineRange } from '@/features/comments'
import {
  rangeForPath,
  useCommentIndex,
  useLineSelection,
  useReviewComments,
} from '@/features/comments'
import {
  type HtmlMode,
  type MarkdownMode,
  usePreferencesStore,
} from '@/features/settings/preferences-store'

import { isHtmlPath, isMarkdownPath } from './file-kinds'
import { pathTestId } from './file-paths'
import { useFileContents, useHtmlPreview, usePathScope, usePinnedEntries } from './files-data'
import type { SourceLine } from './source-lines'
import { type SourceRow, sourceAnchorText, toSourceRows } from './source-rows'
import { useSourceTokens } from './use-file-highlight'
import {
  anchorableRange,
  type ViewerFace,
  type ViewerOverride,
  viewerFace,
  viewerMode,
} from './viewer-mode'

export type FileViewerState = {
  /** The range a comment filed right now would anchor to — null means the whole file. */
  anchorable: LineRange | null
  /** The composer's open anchor, or null while it is closed. */
  anchor: CommentAnchor | null
  clearAnchor: () => void
  /** A pin that the daemon refused, in the reader's words. */
  actionError: string | null
  commentCount: number
  /** Everything a source row needs to paint itself: markers, tokens, selection, focus. */
  ctx: React.ComponentProps<typeof SourceLine>['ctx']
  error: Error | null
  face: ViewerFace
  /** Which mode toggle, if any, belongs above this file. */
  toggle: 'html' | 'markdown' | null
  htmlMode: HtmlMode
  htmlPreview: { html: string | null | undefined; isLoading: boolean; error: Error | null }
  isLoading: boolean
  isPinned: boolean
  markdownMode: MarkdownMode
  /** The markdown source, for the reader face. Empty for anything that is not text. */
  content: string
  rows: SourceRow[]
  /** The live selection, whether or not the face on screen can anchor to it. */
  selected: LineRange | null
  clearSelection: () => void
  /** File a comment: on the open range if there is one, on the whole file otherwise. */
  comment: () => void
  setHtmlMode: (mode: HtmlMode) => void
  setMarkdownMode: (mode: MarkdownMode) => void
  togglePinned: () => void
  view: FileView | undefined
}

/**
 * Everything the file viewer knows, minus the markup.
 *
 * The daemon seam (contents, preview, comments, scope writes), the reader's per-file mode
 * override, the selection, and the composer's anchor are one state machine: the face on screen
 * decides whether a selected range can be commented on at all, and the comment action in the
 * header has to agree with the bar at the bottom. Splitting them across the components that
 * render them is how those two drift apart.
 */
export function useFileViewer({
  active,
  filePath,
  line,
}: {
  active: boolean
  /** Repo-relative. */
  filePath: string
  /** 1-based line to scroll to and tint — a search hit, opened where it matched. */
  line?: number
}): FileViewerState {
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
  // The Settings row is the default a file opens in; the override below is this file's own.
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
  const isText = view?.type === 'text'
  const face = viewerFace({ html, htmlMode, isText, markdown, markdownMode })
  // The daemon re-reads the file to inline its images, so only ask while the preview is up.
  const htmlPreview = useHtmlPreview(filePath, active && face === 'preview')

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

  const anchorable = anchorableRange(selected, face)

  return {
    actionError,
    anchor,
    anchorable,
    clearAnchor: () => {
      setAnchor(null)
    },
    clearSelection: lineSelection.clear,
    // One action, two anchors: with a range open it files against the range, and against the
    // file when there is none. The bar stays the deliberate route; this is the same action
    // where the reader's thumb already is.
    comment: () => {
      if (anchorable === null) {
        setAnchor({ path: filePath })
        return
      }
      setAnchor({
        anchorText: sourceAnchorText(rows, anchorable),
        endLine: anchorable.endLine,
        path: filePath,
        startLine: anchorable.startLine,
      })
      lineSelection.clear()
    },
    commentCount: commentIndex.fileLevel.length + commentIndex.byLine.size,
    content,
    ctx,
    error,
    face,
    htmlMode,
    htmlPreview,
    isLoading,
    isPinned,
    markdownMode,
    rows,
    selected,
    setHtmlMode: (mode) => {
      setHtmlOverride({ mode, path: filePath })
    },
    setMarkdownMode: (mode) => {
      setMarkdownOverride({ mode, path: filePath })
    },
    toggle: !isText || (!markdown && !html) ? null : markdown ? 'markdown' : 'html',
    // A pin is a daemon write that can fail (a vanished path, a read-only scope file); say so
    // rather than letting the tap look like it worked.
    togglePinned: () => {
      const next = !isPinned
      setActionError(null)
      ;(next ? pin(filePath) : unpin(filePath)).catch((cause: unknown) => {
        setActionError(
          `${next ? 'Pin' : 'Unpin'} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        )
      })
    },
    view,
  }
}
