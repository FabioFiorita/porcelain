import type { DiffLine } from '@main/diff'
import type { FeatureReading, ReadingFile } from '@main/feature-view'
import { Button } from '@renderer/components/ui/button'
import { CodeLine, useHighlighter } from '@renderer/components/viewer/code-line'
import { VirtualRows } from '@renderer/components/viewer/virtual-rows'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { languageFor, tokenizeLines } from '@renderer/lib/highlight'
import { cn } from '@renderer/lib/utils'
import { Flag, RefreshCw, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import type { ThemedToken } from 'shiki'
import { SourceMarker } from './feature-list'
import { tokenizeHunks } from './hunks-view'

// One fixed-height row of the reading surface. Everything flattens into a single
// VirtualRows (the house pattern — same as HunksView flattening hunks), so file
// headers, diff lines, and sliced code all sit in one scroll at 20px each.
type ReadingRow =
  | { type: 'layer'; label: string }
  | { type: 'file'; file: ReadingFile }
  | { type: 'note'; note: string }
  | { type: 'hunkHeader'; text: string }
  | { type: 'diff'; line: DiffLine; tokens: ThemedToken[] | null }
  | { type: 'gap'; count: number }
  | { type: 'truncated' }
  | { type: 'code'; lineNo: number; text: string; tokens: ThemedToken[] | null }

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
            rows.push({ type: 'diff', line, tokens: tokenMap?.get(line) ?? null })
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

function ReadingRowView({ row }: { row: ReadingRow }): React.JSX.Element {
  switch (row.type) {
    case 'layer':
      return (
        <p className="flex h-5 items-center bg-muted/30 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
          {row.label}
        </p>
      )
    case 'file':
      return (
        <div className="flex h-5 items-center gap-2 border-t border-border bg-card px-2">
          <SourceMarker source={row.file.source} />
          <span className="font-mono text-xs font-medium">{row.file.path}</span>
          {row.file.additions ? (
            <span className="font-mono text-[10px] text-success">+{row.file.additions}</span>
          ) : null}
          {row.file.deletions ? (
            <span className="font-mono text-[10px] text-destructive">−{row.file.deletions}</span>
          ) : null}
          {row.file.whole && (
            <span className="text-[10px] text-muted-foreground/50">whole file</span>
          )}
        </div>
      )
    case 'note':
      return (
        <p
          className="flex h-5 items-center gap-1.5 border-l-2 border-warning bg-card px-2 text-xs text-muted-foreground"
          title={row.note}
        >
          <Flag className="size-3 shrink-0 text-warning" />
          <span className="truncate">{row.note}</span>
        </p>
      )
    case 'hunkHeader':
      return <p className="h-5 bg-muted/40 px-2 leading-5 text-muted-foreground">{row.text}</p>
    case 'diff':
      return (
        <div className={cn('flex h-5 leading-5', diffLineClass[row.line.kind])}>
          <span className="w-12 shrink-0 select-none pr-2 text-right text-muted-foreground/40">
            {row.line.newLine ?? row.line.oldLine ?? ''}
          </span>
          <CodeLine tokens={row.tokens} text={row.line.text} />
        </div>
      )
    case 'gap':
      return (
        <p className="flex h-5 items-center px-2 text-[10px] text-muted-foreground/45">
          {row.count > 0 ? `⋯ ${row.count} line${row.count === 1 ? '' : 's'}` : '⋯'}
        </p>
      )
    case 'truncated':
      return (
        <p className="flex h-5 items-center px-2 text-[10px] text-muted-foreground/45">
          ⋯ more relevant lines (capped)
        </p>
      )
    case 'code':
      return (
        <div className="flex h-5 leading-5">
          <span className="w-12 shrink-0 select-none pr-2 text-right text-muted-foreground/35">
            {row.lineNo}
          </span>
          <CodeLine tokens={row.tokens} text={row.text} />
        </div>
      )
  }
}

// The viewer's `feature` tab: the inline reading surface. MCP-only — it renders
// only when an agent has pushed a review set; the baseline directs you to the
// Feature sidebar tab (the static list). The slice itself is computed in main.
export function FeatureView(): React.JSX.Element {
  const { reading, refresh } = useFeatureReading()
  const highlighter = useHighlighter()
  const rows = useMemo(
    () => (reading ? buildRows(reading, highlighter) : []),
    [reading, highlighter],
  )

  if (reading === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  if (reading === null) {
    return (
      <div className="mx-auto max-w-md p-8 text-sm text-muted-foreground">
        <p className="mb-2 flex items-center gap-2 font-medium text-foreground">
          <Sparkles className="size-4 text-info" />
          Inline feature read
        </p>
        <p>
          This view renders the whole feature — just the relevant lines — once your agent pushes a
          review set over MCP. Until then, the <span className="font-medium">Feature</span> tab (⌘4)
          shows the static baseline list. Connect Porcelain's MCP server from Settings → “Claude
          Code plugin”.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{reading.name}</span>
          <span className="flex shrink-0 items-center gap-1 rounded bg-info/15 px-1.5 py-0.5 text-[10px] font-normal text-info">
            <Sparkles className="size-3" />
            from agent
          </span>
        </span>
        <Button variant="ghost" size="icon-sm" onClick={refresh} aria-label="Refresh feature view">
          <RefreshCw />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <VirtualRows
          rows={rows}
          className="text-xs"
          renderRow={(row) => <ReadingRowView row={row} />}
        />
      </div>
    </div>
  )
}
