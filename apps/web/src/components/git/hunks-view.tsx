import type { DiffHunk, DiffLine } from '@porcelain/contracts/git'
import { CodeLine, useHighlighter } from '@renderer/components/viewer/code-line'
import { VirtualRows } from '@renderer/components/viewer/virtual-rows'
import { useResolvedTheme } from '@renderer/hooks/use-theme'
import { languageFor, type TokenMap, themeNameFor, tokenizeHunks } from '@renderer/lib/highlight'
import { cn } from '@renderer/lib/utils'
import { type CharRange, intraLineEmphasis } from '@renderer/lib/word-diff'
import { useMemo } from 'react'

/** Intra-line word-diff ranges per diff line (paired del/add lines only). */
type EmphasisMap = Map<DiffLine, CharRange[]>

/** Line-anchored comments, keyed by 1-based line (empty when comments aren't shown). */
interface RenderContext {
  tokens: TokenMap
  emphasis: EmphasisMap
}

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
  | { type: 'unified'; line: DiffLine }
  | SplitRowEntry

interface SplitRowEntry {
  type: 'split'
  left: DiffLine | null
  right: DiffLine | null
}

function toRows(hunks: readonly DiffHunk[], mode: 'unified' | 'split'): DiffRow[] {
  const rows: DiffRow[] = []
  for (const hunk of hunks) {
    rows.push({ type: 'header', text: hunk.header })
    if (mode === 'unified') {
      for (const line of hunk.lines) rows.push({ type: 'unified', line })
    } else {
      for (const row of toSplitRows(hunk)) rows.push({ type: 'split', ...row })
    }
  }
  return rows
}

function DiffRowView({ row, ctx }: { row: DiffRow; ctx: RenderContext }): React.JSX.Element {
  if (row.type === 'header') {
    return <p className="h-5 bg-muted/40 px-2 text-muted-foreground">{row.text}</p>
  }
  if (row.type === 'unified') {
    // data-line carries the new-side line (old-side for a pure deletion) so a text
    // selection here maps to a commentable line range; see lib/line-selection.ts.
    const anchorLine = row.line.newLine ?? row.line.oldLine ?? undefined
    const ranges = ctx.emphasis.get(row.line)
    return (
      <div data-line={anchorLine} className={cn('relative flex px-2', lineClass[row.line.kind])}>
        <LineNo value={row.line.oldLine} />
        <LineNo value={row.line.newLine} />
        <CodeLine
          tokens={ctx.tokens.get(row.line) ?? null}
          text={row.line.text}
          emphasis={ranges ? { ranges, className: emphasisClass[row.line.kind] } : undefined}
        />
      </div>
    )
  }
  return (
    <div className="flex h-full divide-x divide-border">
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
  return (
    <div
      data-line={anchorLine}
      className={cn(
        'relative flex min-w-0 flex-1 overflow-hidden',
        line ? lineClass[line.kind] : '',
      )}
    >
      <LineNo value={line ? (line.kind === 'add' ? line.newLine : line.oldLine) : null} />
      {line ? (
        <CodeLine
          tokens={ctx.tokens.get(line) ?? null}
          text={line.text}
          emphasis={ranges ? { ranges, className: emphasisClass[line.kind] } : undefined}
        />
      ) : (
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
}: {
  hunks: readonly DiffHunk[]
  filePath: string
  diffMode: 'unified' | 'split'
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
  }

  if (hunks.length === 0) {
    return <p className="p-4 font-mono text-xs text-muted-foreground">No changes</p>
  }

  return (
    <VirtualRows
      rows={toRows(hunks, diffMode)}
      className="leading-5"
      fitWidth={diffMode === 'split'}
      renderRow={(row: DiffRow): React.JSX.Element => <DiffRowView row={row} ctx={ctx} />}
    />
  )
}
