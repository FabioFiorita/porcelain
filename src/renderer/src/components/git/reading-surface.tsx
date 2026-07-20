import type { DiffLine } from '@backend/diff'
import type { FeatureReading, ReadingFile } from '@backend/feature-view'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { CodeLine, useHighlighter } from '@renderer/components/viewer/code-line'
import { HtmlView } from '@renderer/components/viewer/html-view'
import { VirtualRows } from '@renderer/components/viewer/virtual-rows'
import {
  buildCommentIndex,
  type CommentIndex,
  useReviewComments,
} from '@renderer/hooks/use-comments'
import { useClearEvidence, useEvidenceHtml } from '@renderer/hooks/use-evidence'
import { useReviewedPaths, useToggleReviewed } from '@renderer/hooks/use-reviewed'
import { useResolvedTheme } from '@renderer/hooks/use-theme'
import {
  HIGHLIGHT_THEMES,
  type HighlightThemeName,
  languageFor,
  themeNameFor,
  tokenizeLines,
} from '@renderer/lib/highlight'
import { type LineSelection, lineSelectionForFile } from '@renderer/lib/line-selection'
import { fileName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useRevealStore } from '@renderer/stores/reveal'
import {
  type ReviewFocusSection,
  type ReviewJumpTarget,
  useReviewFocusStore,
} from '@renderer/stores/review-focus'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import {
  type EvidenceCheck,
  type EvidenceCheckStatus,
  evidenceOverallStatus,
} from '@shared/evidence-check'
import {
  CircleCheck,
  CircleMinus,
  CircleX,
  Eraser,
  FileText,
  MessageSquarePlus,
  ShieldCheck,
  Square,
  SquareCheck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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

// The shared inline reading surface: the Review document (`feature-view.tsx`), the
// pure-diff continuous review (`review-view.tsx`), and the read-only explore view
// (`explore-view.tsx`) all render through this. Everything flattens into a single
// VirtualRows (the house pattern — same as HunksView flattening hunks); code rows
// stay 20px, the document rows (thesis/prose/diagram/evidence) measure dynamically.
export type ReadingRow =
  | { type: 'thesis'; md: string }
  | { type: 'sectionHeader'; index: number; title: string }
  | { type: 'prose'; md: string }
  | { type: 'diagram'; svg: string }
  | { type: 'embed'; html: string; height?: number }
  | { type: 'evidenceHeader'; title: string; checks: EvidenceCheck[] }
  | { type: 'evidenceChecks'; checks: EvidenceCheck[] }
  | { type: 'evidenceBody' }
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

// One file's rows, tokenized up front (the content is already sliced, so this is
// small): changed files per-hunk like HunksView, context/shipped files per-range
// as contiguous text.
function pushFileRows(
  rows: ReadingRow[],
  file: ReadingFile,
  highlighter: ReturnType<typeof useHighlighter>,
  theme: HighlightThemeName,
): void {
  rows.push({ type: 'file', file })
  if (file.note) rows.push({ type: 'note', note: file.note })
  const lang = languageFor(file.path)
  if (file.hunks) {
    const tokenMap =
      highlighter && lang ? tokenizeHunks(highlighter, file.hunks, lang, theme) : null
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
        highlighter && lang ? tokenizeLines(highlighter, range.lines.join('\n'), lang, theme) : null
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

export interface BuildRowsOptions {
  /**
   * When false, omit the loop-evidence chapter rows (Feature canvas Overview tab).
   * Default true so Changes/History continuous review and Explore stay identical.
   */
  includeEvidence?: boolean
}

/**
 * Flatten the whole Review document into rows: thesis, then each walkthrough
 * section (header, prose, optional diagram, anchored code blocks), then the
 * unanchored files under a synthetic "More files" chapter (index
 * `sections.length` — only when sections exist; a section-less reading stays the
 * plain flow-grouped list, which is also what the pure-diff review renders), then
 * the loop-evidence chapter (opt-out via `includeEvidence: false` for the Feature
 * canvas Overview tab).
 */
export function buildRows(
  reading: FeatureReading,
  highlighter: ReturnType<typeof useHighlighter>,
  theme: HighlightThemeName = HIGHLIGHT_THEMES.dark,
  options?: BuildRowsOptions,
): ReadingRow[] {
  const includeEvidence = options?.includeEvidence !== false
  const rows: ReadingRow[] = []
  if (reading.thesis) rows.push({ type: 'thesis', md: reading.thesis })
  reading.sections.forEach((section, index) => {
    rows.push({ type: 'sectionHeader', index, title: section.title })
    if (section.prose.trim()) rows.push({ type: 'prose', md: section.prose })
    if (section.diagram) rows.push({ type: 'diagram', svg: section.diagram })
    if (section.html) rows.push({ type: 'embed', html: section.html, height: section.htmlHeight })
    for (const file of section.files) pushFileRows(rows, file, highlighter, theme)
  })
  if (reading.sections.length > 0 && reading.groups.length > 0) {
    rows.push({ type: 'sectionHeader', index: reading.sections.length, title: 'More files' })
  }
  for (const group of reading.groups) {
    rows.push({ type: 'layer', label: group.layer })
    for (const file of group.files) pushFileRows(rows, file, highlighter, theme)
  }
  if (includeEvidence && reading.evidence) {
    const { title, checks } = reading.evidence
    rows.push({ type: 'evidenceHeader', title, checks })
    if (checks.length > 0) rows.push({ type: 'evidenceChecks', checks })
    rows.push({ type: 'evidenceBody' })
  }
  return rows
}

/** Per-row focus meta: which chapter and file a row belongs to (see review-focus). */
export interface ReadingRowFocus {
  section: ReviewFocusSection
  path: string | null
}

/**
 * Derive each row's chapter + file from the flattened rows, so the scroll handler
 * can publish the topmost visible position with one array lookup. Layer rows under
 * "More files" keep that synthetic chapter; in a section-less document they leave
 * the chapter null (there are no section headers to be "in").
 */
export function buildRowFocus(rows: readonly ReadingRow[]): ReadingRowFocus[] {
  let section: ReviewFocusSection = null
  let path: string | null = null
  return rows.map((row) => {
    switch (row.type) {
      case 'thesis':
        section = null
        path = null
        break
      case 'sectionHeader':
        section = row.index
        path = null
        break
      case 'evidenceHeader':
      case 'evidenceChecks':
      case 'evidenceBody':
        section = 'evidence'
        path = null
        break
      case 'layer':
        path = null
        break
      case 'file':
        path = row.file.path
        break
      default:
        break
    }
    return { section, path }
  })
}

/** The row index a jump request lands on, or null when the target doesn't exist. */
export function rowIndexForTarget(
  rows: readonly ReadingRow[],
  target: ReviewJumpTarget,
): number | null {
  if (target.kind === 'top') return rows.length > 0 ? 0 : null
  const index = rows.findIndex((row) =>
    target.kind === 'evidence'
      ? row.type === 'evidenceHeader'
      : row.type === 'sectionHeader' && row.index === target.index,
  )
  return index === -1 ? null : index
}

/**
 * Wrap agent-authored inline SVG in a minimal srcdoc document for the sandboxed
 * iframe. The SVG is ACTIVE content (it can carry scripts/foreign objects), so it
 * renders ONLY through the `sandbox=""` + `srcdoc` path — never injected into the
 * app DOM (an `audit` invariant, same as evidence HTML).
 */
export function svgDocument(svg: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;color-scheme:dark}svg{display:block;width:100%;height:auto}</style></head><body>${svg}</body></html>`
}

/**
 * Parse an agent-authored inline SVG's intrinsic width/height ratio (width ÷ height)
 * from its markup — explicit `width`/`height` attributes first, else the `viewBox`.
 * Pure string parsing on the parent side (the sandboxed iframe is cross-origin and
 * can't be measured), used to size the diagram container to the SVG's aspect instead
 * of reserving a fixed tall box. Returns null when neither is a usable number
 * (percentage/unitless-missing) so the caller can fall back to a fixed height.
 */
export function svgAspectRatio(svg: string): number | null {
  const tag = svg.match(/<svg\b[^>]*>/i)?.[0]
  if (!tag) return null
  const width = svgDimension(tag, 'width')
  const height = svgDimension(tag, 'height')
  if (width && height) return width / height
  const viewBox = tag.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1]
  if (viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number)
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) return parts[2] / parts[3]
  }
  return null
}

function svgDimension(tag: string, name: string): number | null {
  const raw = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']?\\s*([^"'\\s>]+)`, 'i'))?.[1]
  if (!raw || raw.endsWith('%')) return null
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : null
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

// Agent-authored markdown (thesis / section prose), rendered through the same
// react-markdown pipeline as the markdown reader: remark-gfm, links to the default
// browser, and DEFAULT ESCAPING — no rehype-raw, so embedded HTML stays text (the
// security rule for agent prose; active content goes through the sandboxed iframe
// rows instead). Sticky + viewport-capped like the note row, so the document column
// never rides off under a wide code block's horizontal scroll.
function MarkdownBlock({ md }: { md: string }): React.JSX.Element {
  return (
    <div className="sticky left-0 max-w-[var(--vrows-vw)] px-3 py-2">
      <article className="prose prose-sm dark:prose-invert max-w-3xl font-sans prose-pre:bg-muted/40 prose-code:before:content-none prose-code:after:content-none">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            // window.open routes through main's setWindowOpenHandler → shell.openExternal
            a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          }}
        >
          {md}
        </Markdown>
      </article>
    </div>
  )
}

// The loop-evidence chapter header: title + the clear action (the evidence
// lifecycle — once the human has reviewed the proof, they erase it; the agent can
// always re-push).
export function EvidenceHeaderRow({
  title,
  checks,
}: {
  title: string
  checks: EvidenceCheck[]
}): React.JSX.Element {
  const { clear, isClearing } = useClearEvidence()
  const overall = evidenceOverallStatus(checks)
  return (
    <div className="sticky left-0 flex max-w-[var(--vrows-vw)] items-center gap-2 border-t border-border px-3 pb-1 pt-3">
      <ShieldCheck className="size-3.5 shrink-0 text-info" />
      <h2 className="min-w-0 flex-1 truncate font-sans text-sm font-semibold">{title}</h2>
      {overall && (
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 text-2xs',
            overall === 'pass' ? 'text-success' : 'text-destructive',
          )}
        >
          {overall === 'pass' ? 'Pass' : 'Fail'}
        </Badge>
      )}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0 text-muted-foreground"
              onClick={clear}
              disabled={isClearing}
              aria-label="Clear loop evidence"
            >
              <Eraser />
            </Button>
          }
        />
        <TooltipContent>Clear loop evidence</TooltipContent>
      </Tooltip>
    </div>
  )
}

// Per-status icon + semantic color for a structured check: green tick (pass), red
// cross (fail), muted minus (skip). Same success/destructive tokens as the +/- stats.
const checkStatusStyle: Record<
  EvidenceCheckStatus,
  { Icon: typeof CircleCheck; className: string }
> = {
  pass: { Icon: CircleCheck, className: 'text-success' },
  fail: { Icon: CircleX, className: 'text-destructive' },
  skip: { Icon: CircleMinus, className: 'text-muted-foreground' },
}

// The structured verification checks, between the evidence header and the document.
// Plain NATIVE React — react auto-escapes the agent-authored label/detail strings, so
// (unlike the sandboxed HTML body) there is no dangerouslySetInnerHTML / iframe here.
export function EvidenceChecksRow({ checks }: { checks: EvidenceCheck[] }): React.JSX.Element {
  return (
    <ul className="sticky left-0 flex max-w-[var(--vrows-vw)] flex-col gap-1 px-3 py-1.5">
      {checks.map((check, index) => {
        const { Icon, className } = checkStatusStyle[check.status]
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: static per render, never reordered; labels are agent-authored and not deduped
          <li key={`${index}-${check.label}`} className="flex items-start gap-2">
            <Icon className={cn('mt-0.5 size-3.5 shrink-0', className)} />
            <span className="min-w-0 font-sans text-sm leading-snug">
              {check.label}
              {check.detail && (
                <span className="ml-2 text-xs text-muted-foreground">{check.detail}</span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// The evidence document itself, fetched lazily — the row only mounts when scrolled
// near (virtualization), so the (up to ~4 MB) HTML never rides the 3s reading poll.
// Same fully-sandboxed iframe path as the diagram rows; fixed height, scrolls inside.
function EvidenceBodyRow(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const { evidence } = useEvidenceHtml(repo?.path ?? '')
  return (
    <div className="sticky left-0 max-w-[var(--vrows-vw)] px-3 py-2">
      <div className="h-[28rem] overflow-hidden rounded-md border">
        {evidence ? (
          <HtmlView html={evidence.html} title={evidence.title} />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            {evidence === undefined ? 'Loading…' : 'Loop evidence was cleared.'}
          </p>
        )}
      </div>
    </div>
  )
}

// The section's inline-SVG diagram, sized to the SVG's intrinsic aspect (parsed from
// its markup — the sandboxed iframe can't be measured) instead of a fixed tall box, so
// a short diagram hugs its content. A very tall diagram is capped (max-h) and the outer
// well scrolls. Same fully-sandboxed `sandbox=""` + srcdoc path as evidence — unchanged.
function DiagramRow({ svg }: { svg: string }): React.JSX.Element {
  const ratio = svgAspectRatio(svg)
  return (
    <div className="sticky left-0 max-w-[var(--vrows-vw)] px-3 py-2">
      <div className="max-h-[32rem] overflow-y-auto rounded-md border">
        <div className="w-full" style={ratio ? { aspectRatio: ratio } : { height: '20rem' }}>
          <HtmlView html={svgDocument(svg)} title="Diagram" />
        </div>
      </div>
    </div>
  )
}

// The section's self-contained HTML embed (styled tables, metric summaries, small
// reports) — same fully-sandboxed `sandbox=""` + srcdoc path as evidence/diagrams.
// The sandboxed iframe is cross-origin and can't be measured from the parent, so the
// agent's `htmlHeight` hint (schema-capped 160–1600px, default 448) sizes the well and
// taller content scrolls inside the iframe.
function EmbedRow({ row }: { row: { html: string; height?: number } }): React.JSX.Element {
  return (
    <div className="sticky left-0 max-w-[var(--vrows-vw)] px-3 py-2">
      <div className="overflow-hidden rounded-md border" style={{ height: row.height ?? 448 }}>
        <HtmlView html={row.html} title="Section embed" />
      </div>
    </div>
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
    case 'thesis':
    case 'prose':
      return <MarkdownBlock md={row.md} />
    case 'sectionHeader':
      return (
        <div className="sticky left-0 max-w-[var(--vrows-vw)] border-t border-border px-3 pb-1 pt-3">
          <h2 className="truncate font-sans text-sm font-semibold">{row.title}</h2>
        </div>
      )
    case 'diagram':
      return <DiagramRow svg={row.svg} />
    case 'embed':
      return <EmbedRow row={row} />
    case 'evidenceHeader':
      return <EvidenceHeaderRow title={row.title} checks={row.checks} />
    case 'evidenceChecks':
      return <EvidenceChecksRow checks={row.checks} />
    case 'evidenceBody':
      return <EvidenceBodyRow />
    case 'layer':
      return (
        <p className="flex h-5 items-center bg-muted/30 px-2 font-sans text-2xs font-medium uppercase tracking-wider text-muted-foreground/80">
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
 * are normally 20px, but the note/prose/iframe rows wrap or fix their own height, so
 * this surface opts into VirtualRows' dynamic measurement (it's small + sliced — the
 * perf invariant that keeps full files fixed-height still holds for the file/diff
 * viewers). One shared CommentComposer renders the dialog any row's context menu opens.
 * `fileActions` adds mark-reviewed / open-file chrome on file-name rows (Changes /
 * History continuous review); Feature/Explore leave it off. `trackFocus` (the Review
 * document only) publishes the topmost visible chapter/file to the review-focus store
 * and consumes its jump requests. `includeEvidence` defaults true — Feature Overview
 * passes false so loop evidence lives in its own canvas tab.
 */
export function ReadingSurfaceBody({
  reading,
  fileActions,
  trackFocus = false,
  includeEvidence = true,
}: {
  reading: FeatureReading
  fileActions?: ReadingFileActions
  trackFocus?: boolean
  includeEvidence?: boolean
}): React.JSX.Element {
  const highlighter = useHighlighter()
  const theme = themeNameFor(useResolvedTheme())
  const rows = useMemo(
    () => buildRows(reading, highlighter, theme, { includeEvidence }),
    [reading, highlighter, theme, includeEvidence],
  )
  const [anchor, setAnchor] = useState<CommentAnchor | null>(null)
  const comments = useReviewComments()
  const setVisible = useReviewFocusStore((s) => s.setVisible)
  const clearJump = useReviewFocusStore((s) => s.clearJump)
  const jump = useReviewFocusStore((s) => s.jump)
  const [scrollTo, setScrollTo] = useState<{ line: number; nonce: number } | null>(null)

  // Publish scroll position to the review-focus store: one array lookup per
  // top-row CHANGE (VirtualRows already dedupes), and the store setter no-ops on
  // equal values — no per-scroll-event re-render storm.
  const rowFocus = useMemo(() => (trackFocus ? buildRowFocus(rows) : null), [trackFocus, rows])
  const onTopRow = useMemo(() => {
    if (!rowFocus) return undefined
    return (index: number): void => {
      const meta = rowFocus[index]
      if (meta) setVisible(meta.section, meta.path)
    }
  }, [rowFocus, setVisible])

  // Consume a pending jump (outline click, J/K): resolve the target to a row and
  // scroll it to the top. The nonce re-fires a repeated jump to the same target.
  useEffect(() => {
    if (!trackFocus || !jump) return
    const index = rowIndexForTarget(rows, jump.target)
    if (index !== null) setScrollTo({ line: index + 1, nonce: jump.nonce })
    clearJump()
  }, [trackFocus, jump, rows, clearJump])

  // One comment index per file in the reading (built once per file), so each diff/code
  // row can mark its commented lines. Comments key on the same repo-relative paths.
  const commentIndexByPath = useMemo(() => {
    const map = new Map<string, CommentIndex>()
    const files = [
      ...reading.sections.flatMap((section) => section.files),
      ...reading.groups.flatMap((group) => group.files),
    ]
    for (const file of files) {
      if (!map.has(file.path)) map.set(file.path, buildCommentIndex(comments, file.path))
    }
    return map
  }, [comments, reading])

  return (
    <>
      <VirtualRows
        rows={rows}
        className="text-xs"
        dynamicHeight
        scrollToLine={scrollTo?.line}
        scrollNonce={scrollTo?.nonce}
        scrollAlign="start"
        onTopRow={onTopRow}
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
