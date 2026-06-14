import type { DiffHunk, DiffLine } from '@main/diff'
import { CodeLine, useHighlighter } from '@renderer/components/viewer/code-line'
import { VirtualRows } from '@renderer/components/viewer/virtual-rows'
import { type HIGHLIGHT_THEME, languageFor } from '@renderer/lib/highlight'
import { cn } from '@renderer/lib/utils'
import type { BundledLanguage, HighlighterGeneric } from 'shiki'

type Highlighter = HighlighterGeneric<BundledLanguage, typeof HIGHLIGHT_THEME>

interface RenderContext {
  lang: BundledLanguage | null
  highlighter: Highlighter | null
}

const lineClass: Record<DiffLine['kind'], string> = {
  add: 'bg-diff-add',
  del: 'bg-diff-del',
  context: '',
}

function LineNo({ value }: { value: number | null }): React.JSX.Element {
  return (
    <span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground/60">
      {value ?? ''}
    </span>
  )
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
    return (
      <div className={cn('flex px-2', lineClass[row.line.kind])}>
        <LineNo value={row.line.oldLine} />
        <LineNo value={row.line.newLine} />
        <CodeLine text={row.line.text} lang={ctx.lang} highlighter={ctx.highlighter} />
      </div>
    )
  }
  return (
    <div className="flex h-full divide-x divide-border">
      <SplitCell line={row.left} ctx={ctx} />
      <SplitCell line={row.right} ctx={ctx} />
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
  ctx,
}: {
  line: DiffLine | null
  ctx: RenderContext
}): React.JSX.Element {
  return (
    <div className={cn('flex min-w-0 flex-1 overflow-hidden', line ? lineClass[line.kind] : '')}>
      <LineNo value={line ? (line.kind === 'add' ? line.newLine : line.oldLine) : null} />
      {line ? (
        <CodeLine text={line.text} lang={ctx.lang} highlighter={ctx.highlighter} />
      ) : (
        <pre className="flex-1"> </pre>
      )}
    </div>
  )
}

/** Shared hunk renderer: virtualized unified/split rows with highlighting. */
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
  const ctx: RenderContext = { lang: languageFor(filePath), highlighter }

  if (hunks.length === 0) {
    return <p className="p-4 font-mono text-xs text-muted-foreground">No changes</p>
  }

  return (
    <VirtualRows
      rows={toRows(hunks, diffMode)}
      className="leading-5"
      fitWidth={diffMode === 'split'}
      renderRow={(row) => <DiffRowView row={row} ctx={ctx} />}
    />
  )
}
