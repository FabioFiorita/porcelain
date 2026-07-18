import type { DiffLine } from '@backend/diff'
import type { FeatureReading, ReadingFile } from '@backend/feature-view'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { CodeLine, useHighlighter } from '@renderer/components/viewer/code-line'
import { VirtualRows } from '@renderer/components/viewer/virtual-rows'
import {
  buildCommentIndex,
  type CommentIndex,
  useReviewComments,
} from '@renderer/hooks/use-comments'
import { useReviewedPaths, useToggleReviewed } from '@renderer/hooks/use-reviewed'
import { languageFor, tokenizeLines } from '@renderer/lib/highlight'
import { type LineSelection, lineSelectionForFile } from '@renderer/lib/line-selection'
import { fileName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useRevealStore } from '@renderer/stores/reveal'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { FileText, MessageSquarePlus, Square, SquareCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ThemedToken } from 'shiki'
import { type CommentAnchor, CommentComposer } from './comment-composer'
import { LineDecorations } from './comment-marker'
import { SourceMarker } from './feature-list'
import { tokenizeHunks } from './hunks-view'

/** Optional chrome on each file-name row in a pure-diff continuous review. */
export interface ReadingFileActions {
  /** Show mark/unmark reviewed on the file header (working-tree / branch review). */
  reviewed?: boolean
  /** Show open-file control (hidden for deleted files via `ReadingFile.status`). */
  openFile?: boolean
  /** Show the feature source marker (changed/context/shipped). Off for pure diffs. */
  showSource?: boolean
}

// The shared inline reading surface: the feature read (`feature-view.tsx`) and
// the read-only explore view (`explore-view.tsx`) both render through this. One
// fixed-height row type per line; everything flattens into a single VirtualRows
// (the house pattern — same as HunksView flattening hunks) at 20px each.
type ReadingRow =
  | { type: 'layer'; label: string }
  | { type: 'file'; file: ReadingFile }
  | { type: 'note'; note: string }
  | { type: 'hunkHeader'; text: string }
  | { type: 'diff'; path: string; line: DiffLine; tokens: ThemedToken[] | null }
  | { type: 'gap'; count: number }
  | { type: 'truncated' }
  | { type: 'code'; path: string; lineNo: number; text: string; tokens: ThemedToken[] | null }

const diffLineClass: Record<DiffLine['kind'], string> = {
  add: 'bg-diff-add',
  del: 'bg-diff-del',
  context: '',
}

// Flatten the whole feature into rows, tokenizing each file's content up front
// (the content is already sliced, so this is small): changed files per-hunk like
// HunksView, context/shipped files per-range as contiguous text.
export function buildRows(
  reading: FeatureReading,
  highlighter: ReturnType<typeof useHighlighter>,
): ReadingRow[] {
  const rows: ReadingRow[] = []
  for (const group of reading.groups) {
    rows.push({ type: 'layer', label: group.layer })
    for (const file of group.files) {
      rows.push({ type: 'file', file })
      if (file.note) rows.push({ type: 'note', note: file.note })
      const lang = languageFor(file.path)
      if (file.hunks) {
        const tokenMap = highlighter && lang ? tokenizeHunks(highlighter, file.hunks, lang) : null
        for (const hunk of file.hunks) {
          rows.push({ type: 'hunkHeader', text: hunk.header })
          for (const line of hunk.lines) {
            rows.push({ type: 'diff', path: file.path, line, tokens: tokenMap?.get(line) ?? null })
          }
        }
      } else if (file.ranges) {
        for (const range of file.ranges) {
          if (range.gapBefore > 0) rows.push({ type: 'gap', count: range.gapBefore })
          const tokenLines =
            highlighter && lang ? tokenizeLines(highlighter, range.lines.join('\n'), lang) : null
          range.lines.forEach((text, i) => {
            rows.push({
              type: 'code',
              path: file.path,
              lineNo: range.startLine + i,
              text,
              tokens: tokenLines?.[i] ?? null,
            })
          })
        }
        if (file.truncated) rows.push({ type: 'truncated' })
      }
    }
  }
  return rows
}

// Right-click a feature file (or one of its lines) to leave a review comment without
// leaving the read — "Add comment" anchors to the line (or the drag-selected range),
// "Comment on file" to the file. One CommentComposer is mounted by the body; these
// items just set its anchor. The trigger stays text-selectable (the surface is read)
// and `block` so the measured row height comes from the inner content. On open it reads
// the DOM selection CLAMPED to this file (rows carry data-file), so a multi-line
// drag-select anchors to the whole range; otherwise it falls back to the single line.
// Optional `fileActions` add mark-reviewed / open-file on the pure-diff continuous review.
function CommentMenu({
  path,
  line,
  onComment,
  fileActions,
  isReviewed,
  onToggleReviewed,
  onOpenFile,
  canOpenFile,
  children,
}: {
  path: string
  line?: { lineNo: number; text: string }
  onComment: (anchor: CommentAnchor) => void
  fileActions?: ReadingFileActions
  isReviewed?: boolean
  onToggleReviewed?: () => void | Promise<void>
  onOpenFile?: () => void
  canOpenFile?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const [selection, setSelection] = useState<LineSelection | null>(null)
  const lineAnchor: CommentAnchor | null = selection
    ? {
        path,
        startLine: selection.startLine,
        endLine: selection.endLine,
        anchorText: selection.text,
      }
    : line
      ? { path, startLine: line.lineNo, endLine: line.lineNo, anchorText: line.text.slice(0, 2000) }
      : null
  const spanned = selection ? selection.endLine - selection.startLine + 1 : 0
  return (
    <ContextMenu onOpenChange={(open) => setSelection(open ? lineSelectionForFile(path) : null)}>
      <ContextMenuTrigger className="block select-text">{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {lineAnchor && (
          <ContextMenuItem onClick={() => onComment(lineAnchor)}>
            <MessageSquarePlus /> Add comment{spanned > 1 ? ` (${spanned} lines)` : ''}
          </ContextMenuItem>
        )}
        {fileActions?.reviewed && onToggleReviewed && (
          <ContextMenuItem
            onClick={async () => {
              await onToggleReviewed()
            }}
          >
            {isReviewed ? <Square /> : <SquareCheck />}
            {isReviewed ? 'Unmark reviewed' : 'Mark reviewed'}
          </ContextMenuItem>
        )}
        {fileActions?.openFile && canOpenFile && onOpenFile && (
          <ContextMenuItem onClick={onOpenFile}>
            <FileText />
            Open file
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => onComment({ path })}>
          <MessageSquarePlus /> Comment on file
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** Whether the open composer is anchored to `line` in `path` (for the pending tint). */
function isPending(anchor: CommentAnchor | null, path: string, line: number | undefined): boolean {
  if (!anchor || line === undefined || anchor.path !== path || anchor.startLine === undefined) {
    return false
  }
  return line >= anchor.startLine && line <= (anchor.endLine ?? anchor.startLine)
}

function FileHeaderRow({
  file,
  onComment,
  fileActions,
}: {
  file: ReadingFile
  onComment: (anchor: CommentAnchor) => void
  fileActions?: ReadingFileActions
}): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
  const reveal = useRevealStore((s) => s.reveal)
  const reviewed = useReviewedPaths()
  const { mark, unmark } = useToggleReviewed()
  const isReviewed = reviewed.has(file.path)
  const canOpenFile = file.status !== 'deleted'
  const showSource = fileActions?.showSource !== false

  const openFile = (): void => {
    if (!repo || !canOpenFile) return
    const absolute = `${repo.path}/${file.path}`
    openTab({
      id: tabId('file', absolute),
      kind: 'file',
      title: fileName(file.path),
      path: absolute,
      preview: true,
    })
    setSidebarTab('files')
    reveal(absolute)
  }

  const toggleReviewed = async (): Promise<void> => {
    if (isReviewed) await unmark(file.path)
    else await mark(file.path)
  }

  return (
    <CommentMenu
      path={file.path}
      onComment={onComment}
      fileActions={fileActions}
      isReviewed={isReviewed}
      onToggleReviewed={fileActions?.reviewed ? toggleReviewed : undefined}
      onOpenFile={fileActions?.openFile ? openFile : undefined}
      canOpenFile={canOpenFile}
    >
      <div className="flex h-5 items-center gap-2 border-t border-border bg-card px-2">
        {showSource && <SourceMarker source={file.source} />}
        <span
          className={cn(
            'min-w-0 flex-1 truncate font-mono text-xs font-medium',
            isReviewed && fileActions?.reviewed && 'text-muted-foreground line-through',
          )}
        >
          {file.path}
        </span>
        {file.additions ? (
          <span className="font-mono text-2xs text-success">+{file.additions}</span>
        ) : null}
        {file.deletions ? (
          <span className="font-mono text-2xs text-destructive">−{file.deletions}</span>
        ) : null}
        {file.whole && <span className="text-2xs text-muted-foreground/50">whole file</span>}
        {fileActions?.reviewed && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={async (e) => {
                    e.stopPropagation()
                    await toggleReviewed()
                  }}
                  className={cn(
                    'shrink-0',
                    isReviewed ? 'text-success' : 'text-muted-foreground hover:text-foreground',
                  )}
                  aria-label={isReviewed ? 'Unmark reviewed' : 'Mark reviewed'}
                >
                  {isReviewed ? (
                    <SquareCheck className="size-3.5" />
                  ) : (
                    <Square className="size-3.5" />
                  )}
                </Button>
              }
            />
            <TooltipContent>{isReviewed ? 'Unmark reviewed' : 'Mark reviewed'}</TooltipContent>
          </Tooltip>
        )}
        {fileActions?.openFile && canOpenFile && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    openFile()
                  }}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Open file"
                >
                  <FileText className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Open file</TooltipContent>
          </Tooltip>
        )}
      </div>
    </CommentMenu>
  )
}

function ReadingRowView({
  row,
  onComment,
  commentIndexByPath,
  pendingAnchor,
  fileActions,
}: {
  row: ReadingRow
  onComment: (anchor: CommentAnchor) => void
  commentIndexByPath: Map<string, CommentIndex>
  pendingAnchor: CommentAnchor | null
  fileActions?: ReadingFileActions
}): React.JSX.Element {
  switch (row.type) {
    case 'layer':
      return (
        <p className="flex h-5 items-center bg-muted/30 px-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground/80">
          {row.label}
        </p>
      )
    case 'file':
      return <FileHeaderRow file={row.file} onComment={onComment} fileActions={fileActions} />
    case 'note':
      // The note wraps to multiple lines and is capped at the viewport width (the
      // `--vrows-vw` var, NOT the surface's horizontally-scrolling `w-max` content), so
      // the whole block — inline "Note" label included — never overflows sideways. It
      // sticks left so it stays readable when the reader scrolls a wide diff sideways.
      // A block (not flex), so wrapped lines flow full-width under the label.
      return (
        <div className="sticky left-0 max-w-[var(--vrows-vw)] whitespace-pre-wrap break-words border-l-2 border-muted-foreground/25 bg-muted/30 px-2 py-1 font-sans text-xs leading-relaxed text-muted-foreground">
          <span className="mr-2 text-3xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Note
          </span>
          {row.note}
        </div>
      )
    case 'hunkHeader':
      return <p className="h-5 bg-muted/40 px-2 leading-5 text-muted-foreground">{row.text}</p>
    case 'diff': {
      const newLine = row.line.newLine
      const anchorLine = row.line.newLine ?? row.line.oldLine ?? undefined
      const comments =
        anchorLine !== undefined
          ? commentIndexByPath.get(row.path)?.byLine.get(anchorLine)
          : undefined
      return (
        <CommentMenu
          path={row.path}
          line={newLine === null ? undefined : { lineNo: newLine, text: row.line.text }}
          onComment={onComment}
        >
          {/* data-file + data-line let a drag-selection map to a line range in THIS
              file; new-side line (old-side for a pure deletion), like the diff view. */}
          <div
            data-file={row.path}
            data-line={anchorLine}
            className={cn('relative flex h-5 leading-5', diffLineClass[row.line.kind])}
          >
            <LineDecorations
              comments={comments}
              pending={isPending(pendingAnchor, row.path, anchorLine)}
            />
            <span className="w-12 shrink-0 select-none pr-2 text-right text-muted-foreground/40">
              {row.line.newLine ?? row.line.oldLine ?? ''}
            </span>
            <CodeLine tokens={row.tokens} text={row.line.text} />
          </div>
        </CommentMenu>
      )
    }
    case 'gap':
      return (
        <p className="flex h-5 items-center px-2 text-2xs text-muted-foreground/45">
          {row.count > 0 ? `⋯ ${row.count} line${row.count === 1 ? '' : 's'}` : '⋯'}
        </p>
      )
    case 'truncated':
      return (
        <p className="flex h-5 items-center px-2 text-2xs text-muted-foreground/45">
          ⋯ more relevant lines (capped)
        </p>
      )
    case 'code': {
      const comments = commentIndexByPath.get(row.path)?.byLine.get(row.lineNo)
      return (
        <CommentMenu
          path={row.path}
          line={{ lineNo: row.lineNo, text: row.text }}
          onComment={onComment}
        >
          <div data-file={row.path} data-line={row.lineNo} className="relative flex h-5 leading-5">
            <LineDecorations
              comments={comments}
              pending={isPending(pendingAnchor, row.path, row.lineNo)}
            />
            <span className="w-12 shrink-0 select-none pr-2 text-right text-muted-foreground/35">
              {row.lineNo}
            </span>
            <CodeLine tokens={row.tokens} text={row.text} />
          </div>
        </CommentMenu>
      )
    }
  }
}

/**
 * The scrollable body: flattens a FeatureReading into one virtualized row list. Rows
 * are normally 20px, but the note row wraps to any height, so this surface opts into
 * VirtualRows' dynamic measurement (it's small + sliced — the perf invariant that
 * keeps full files fixed-height still holds for the file/diff viewers). One shared
 * CommentComposer renders the dialog any row's context menu opens.
 * `fileActions` adds mark-reviewed / open-file chrome on file-name rows (Changes /
 * History continuous review); Feature/Explore leave it off.
 */
export function ReadingSurfaceBody({
  reading,
  fileActions,
}: {
  reading: FeatureReading
  fileActions?: ReadingFileActions
}): React.JSX.Element {
  const highlighter = useHighlighter()
  const rows = useMemo(() => buildRows(reading, highlighter), [reading, highlighter])
  const [anchor, setAnchor] = useState<CommentAnchor | null>(null)
  const comments = useReviewComments()

  // One comment index per file in the reading (built once per file), so each diff/code
  // row can mark its commented lines. Comments key on the same repo-relative paths.
  const commentIndexByPath = useMemo(() => {
    const map = new Map<string, CommentIndex>()
    for (const group of reading.groups) {
      for (const file of group.files) {
        if (!map.has(file.path)) map.set(file.path, buildCommentIndex(comments, file.path))
      }
    }
    return map
  }, [comments, reading])

  return (
    <>
      <VirtualRows
        rows={rows}
        className="text-xs"
        dynamicHeight
        renderRow={(row) => (
          <ReadingRowView
            row={row}
            onComment={setAnchor}
            commentIndexByPath={commentIndexByPath}
            pendingAnchor={anchor}
            fileActions={fileActions}
          />
        )}
      />
      <CommentComposer
        anchor={anchor}
        open={anchor !== null}
        onOpenChange={(open) => {
          if (!open) setAnchor(null)
        }}
      />
    </>
  )
}
