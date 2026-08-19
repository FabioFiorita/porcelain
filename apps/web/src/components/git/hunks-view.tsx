import type { DiffHunk, DiffLine } from '@porcelain/contracts/git'
import type { ReviewComment } from '@porcelain/contracts/review'
import { commentRowClass, LineDecorations } from '@renderer/components/git/comment-marker'
import { CodeLine, useHighlighter } from '@renderer/components/viewer/code-line'
import { VirtualRows } from '@renderer/components/viewer/virtual-rows'
import type { CommentIndex } from '@renderer/features/review'
import { useResolvedTheme } from '@renderer/hooks/use-theme'
import type { DiffGap } from '@renderer/lib/collapse-hunks'
import { EXPAND_STEP } from '@renderer/lib/collapse-hunks'
import { languageFor, type TokenMap, themeNameFor, tokenizeHunks } from '@renderer/lib/highlight'
import { formatHunkHeader } from '@renderer/lib/hunk-header'
import { cn } from '@renderer/lib/utils'
import { type CharRange, intraLineEmphasis } from '@renderer/lib/word-diff'
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react'
import { useMemo } from 'react'

/** Intra-line word-diff ranges per diff line (paired del/add lines only). */
type EmphasisMap = Map<DiffLine, CharRange[]>

/** Line-anchored comments, keyed by 1-based line (empty when comments aren't shown). */
type CommentsByLine = Map<number, ReviewComment[]>

const NO_COMMENTS: CommentsByLine = new Map()
const NO_PENDING: ReadonlySet<number> = new Set()
const NO_GAPS: readonly DiffGap[] = []

interface RenderContext {
  tokens: TokenMap
  emphasis: EmphasisMap
  commentsByLine: CommentsByLine
  pendingLines: ReadonlySet<number>
  filePath: string
  onExpand: ExpandHandler | undefined
}

/** Reveal part of a collapsed gap: its bottom (`up`), its top (`down`), or all of it. */
export type ExpandHandler = (gap: DiffGap, direction: 'up' | 'down' | 'whole') => void

const lineClass: Record<DiffLine['kind'], string> = {
  add: 'bg-diff-add',
  del: 'bg-diff-del',
  context: '',
}

/** Stronger bg for the changed words inside a line, sitting over the line's lineClass. */
const emphasisClass: Record<DiffLine['kind'], string> = {
  add: 'rounded-sm bg-diff-add-emphasis',
  del: 'rounded-sm bg-diff-del-emphasis',
  context: '',
}

function LineNo({ value }: { value: number | null }): React.JSX.Element {
  return (
    <span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground/60">
      {value ?? ''}
    </span>
  )
}

/**
 * The commentable line a split cell owns. The new side owns adds and context (comments
 * anchor to new-side lines); the old side owns only pure deletions (no new-side line),
 * so a context line is marked once — on the new side.
 */
function cellAnchorLine(line: DiffLine, side: 'left' | 'right'): number | undefined {
  if (side === 'right') return line.newLine ?? undefined
  return line.kind === 'del' ? (line.oldLine ?? undefined) : undefined
}

type DiffRow =
  | { type: 'header'; text: string }
  | { type: 'gap'; gap: DiffGap }
  | { type: 'unified'; line: DiffLine }
  | SplitRowEntry

interface SplitRowEntry {
  type: 'split'
  left: DiffLine | null
  right: DiffLine | null
}

function toRows(
  hunks: readonly DiffHunk[],
  mode: 'unified' | 'split',
  gaps: readonly DiffGap[],
): DiffRow[] {
  const rows: DiffRow[] = []
  const pushGaps = (index: number): void => {
    for (const gap of gaps) if (gap.beforeHunk === index) rows.push({ type: 'gap', gap })
  }
  hunks.forEach((hunk, index) => {
    pushGaps(index)
    // A collapsed hunk carries no header — its gap rows say where it sits.
    if (hunk.header !== '') rows.push({ type: 'header', text: hunk.header })
    if (mode === 'unified') {
      for (const line of hunk.lines) rows.push({ type: 'unified', line })
    } else {
      for (const row of toSplitRows(hunk)) rows.push({ type: 'split', ...row })
    }
  })
  pushGaps(hunks.length)
  return rows
}

function GapRow({
  gap,
  onExpand,
}: {
  gap: DiffGap
  onExpand: ExpandHandler | undefined
}): React.JSX.Element {
  const label = `${gap.count} unchanged ${gap.count === 1 ? 'line' : 'lines'}`
  const controls = gap.expandable && onExpand !== undefined
  return (
    <div className="flex h-5 items-center gap-1 bg-muted/40 px-2 text-muted-foreground">
      {controls &&
        (gap.count <= EXPAND_STEP ? (
          <button
            type="button"
            aria-label={`Expand ${label}`}
            className="rounded-sm px-0.5 hover:bg-accent hover:text-foreground"
            onClick={() => onExpand(gap, 'whole')}
          >
            <ChevronsUpDown className="size-3" />
          </button>
        ) : (
          <>
            <button
              type="button"
              aria-label={`Expand up from line ${gap.endNew}`}
              className="rounded-sm px-0.5 hover:bg-accent hover:text-foreground"
              onClick={() => onExpand(gap, 'up')}
            >
              <ChevronUp className="size-3" />
            </button>
            <button
              type="button"
              aria-label={`Expand down from line ${gap.startNew}`}
              className="rounded-sm px-0.5 hover:bg-accent hover:text-foreground"
              onClick={() => onExpand(gap, 'down')}
            >
              <ChevronDown className="size-3" />
            </button>
          </>
        ))}
      <span className="select-none">{`⋯ ${label}`}</span>
    </div>
  )
}

function DiffRowView({ row, ctx }: { row: DiffRow; ctx: RenderContext }): React.JSX.Element {
  if (row.type === 'gap') {
    return <GapRow gap={row.gap} onExpand={ctx.onExpand} />
  }
  if (row.type === 'header') {
    return (
      <p className="h-5 bg-muted/40 px-2 text-muted-foreground">{formatHunkHeader(row.text)}</p>
    )
  }
  if (row.type === 'unified') {
    // data-line carries the new-side line (old-side for a pure deletion) so a text
    // selection here maps to a commentable line range; see lib/line-selection.ts.
    const anchorLine = row.line.newLine ?? row.line.oldLine ?? undefined
    const ranges = ctx.emphasis.get(row.line)
    const comments = anchorLine !== undefined ? ctx.commentsByLine.get(anchorLine) : undefined
    const pending = anchorLine !== undefined && ctx.pendingLines.has(anchorLine)
    const tint = commentRowClass(comments, pending)
    return (
      <div
        data-file={ctx.filePath}
        data-line={anchorLine}
        className={cn('relative flex px-2', tint ?? lineClass[row.line.kind])}
      >
        <LineDecorations comments={comments} />
        <LineNo value={row.line.oldLine} />
        <LineNo value={row.line.newLine} />
        <CodeLine
          tokens={ctx.tokens.get(row.line) ?? null}
          text={row.line.text}
          emphasis={ranges ? { ranges, className: emphasisClass[row.line.kind] } : undefined}
          wrap
        />
      </div>
    )
  }
  // No `h-full` here: once rows measure themselves the parent height is `auto`, so
  // `h-full` resolved to the content height of the SHORTER side and the divider stopped
  // short of a wrapped cell. Dropping it leaves flex's default `align-items: stretch`,
  // which sizes both cells to the taller side.
  return (
    <div className="flex divide-x divide-border">
      <SplitCell line={row.left} side="left" ctx={ctx} />
      <SplitCell line={row.right} side="right" ctx={ctx} />
    </div>
  )
}

interface SplitRow {
  left: DiffLine | null
  right: DiffLine | null
}

function toSplitRows(hunk: DiffHunk): SplitRow[] {
  const rows: SplitRow[] = []
  let pendingDels: DiffLine[] = []

  const flush = (): void => {
    for (const del of pendingDels) rows.push({ left: del, right: null })
    pendingDels = []
  }

  for (const line of hunk.lines) {
    if (line.kind === 'del') {
      pendingDels.push(line)
    } else if (line.kind === 'add') {
      const del = pendingDels.shift()
      rows.push({ left: del ?? null, right: line })
    } else {
      flush()
      rows.push({ left: line, right: line })
    }
  }
  flush()
  return rows
}

function SplitCell({
  line,
  side,
  ctx,
}: {
  line: DiffLine | null
  side: 'left' | 'right'
  ctx: RenderContext
}): React.JSX.Element {
  const ranges = line ? ctx.emphasis.get(line) : undefined
  const anchorLine = line ? cellAnchorLine(line, side) : undefined
  const comments = anchorLine !== undefined ? ctx.commentsByLine.get(anchorLine) : undefined
  const pending = anchorLine !== undefined && ctx.pendingLines.has(anchorLine)
  const tint = commentRowClass(comments, pending)
  return (
    <div
      data-file={ctx.filePath}
      data-line={anchorLine}
      className={cn('relative flex min-w-0 flex-1', tint ?? (line ? lineClass[line.kind] : ''))}
    >
      <LineDecorations comments={comments} />
      <LineNo value={line ? (line.kind === 'add' ? line.newLine : line.oldLine) : null} />
      {line ? (
        <CodeLine
          tokens={ctx.tokens.get(line) ?? null}
          text={line.text}
          emphasis={ranges ? { ranges, className: emphasisClass[line.kind] } : undefined}
          wrap
        />
      ) : (
        // No wrap class needed, and no `overflow-hidden` on the cell to fall back on:
        // this filler is a single space, so it can never widen the cell. Every cell
        // that DOES hold text renders `CodeLine wrap`, which is what makes dropping
        // the cell's `overflow-hidden` safe.
        <pre className="flex-1"> </pre>
      )}
    </div>
  )
}

/**
 * Shared hunk renderer: virtualized unified/split rows with highlighting.
 */
export function HunksView({
  hunks,
  filePath,
  diffMode,
  layout = 'pane',
  commentIndex,
  pendingLines,
  gaps,
  onExpand,
}: {
  hunks: readonly DiffHunk[]
  filePath: string
  diffMode: 'unified' | 'split'
  /** `pane` fills a Viewer card. `content` grows with the hunks (stacked review). */
  layout?: 'pane' | 'content'
  commentIndex?: CommentIndex
  pendingLines?: ReadonlySet<number>
  /** Collapsed context runs to draw between hunks. Omitted: no gap rows, as the
   *  stacked reader and commit views want. */
  gaps?: readonly DiffGap[]
  onExpand?: ExpandHandler
}): React.JSX.Element {
  const highlighter = useHighlighter()
  const lang = languageFor(filePath)
  const theme = themeNameFor(useResolvedTheme())
  const tokens = useMemo<TokenMap>(
    () => (highlighter && lang ? tokenizeHunks(highlighter, hunks, lang, theme) : new Map()),
    [highlighter, lang, hunks, theme],
  )
  const emphasis = useMemo<EmphasisMap>(() => intraLineEmphasis(hunks), [hunks])
  const ctx: RenderContext = {
    tokens,
    emphasis,
    commentsByLine: commentIndex?.byLine ?? NO_COMMENTS,
    pendingLines: pendingLines ?? NO_PENDING,
    filePath,
    onExpand,
  }

  if (hunks.length === 0 && (gaps === undefined || gaps.length === 0)) {
    return <p className="p-4 font-mono text-xs text-muted-foreground">No changes</p>
  }

  const rows = toRows(hunks, diffMode, gaps ?? NO_GAPS)
  if (layout === 'content') {
    return (
      <div className="text-xs leading-5">
        {rows.map((row, index) => (
          <DiffRowView
            key={
              row.type === 'gap'
                ? `g:${row.gap.startNew}:${index}`
                : row.type === 'header'
                  ? `h:${row.text}:${index}`
                  : row.type === 'unified'
                    ? `u:${row.line.oldLine}:${row.line.newLine}:${index}`
                    : `s:${row.left?.oldLine}:${row.right?.newLine}:${index}`
            }
            row={row}
            ctx={ctx}
          />
        ))}
      </div>
    )
  }

  // Lines soft-wrap, so a row never extends past the viewport: `fitWidth` pins the row
  // width to the scroller (there is nothing left to scroll sideways to), and
  // `dynamicHeight` measures each row because a wrapped line is 2+ lines tall.
  return (
    <VirtualRows
      rows={rows}
      className="leading-5"
      fitWidth
      dynamicHeight
      renderRow={(row: DiffRow): React.JSX.Element => <DiffRowView row={row} ctx={ctx} />}
    />
  )
}
