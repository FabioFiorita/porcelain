import type { DiffLine } from '@main/diff'
import type { FeatureReading, ReadingFile } from '@main/feature-view'
import { CodeLine, useHighlighter } from '@renderer/components/viewer/code-line'
import { VirtualRows } from '@renderer/components/viewer/virtual-rows'
import { languageFor, tokenizeLines } from '@renderer/lib/highlight'
import { cn } from '@renderer/lib/utils'
import { Flag } from 'lucide-react'
import { useMemo } from 'react'
import type { ThemedToken } from 'shiki'
import { SourceMarker } from './feature-list'
import { tokenizeHunks } from './hunks-view'

// The shared inline reading surface: the MCP feature read (`feature-view.tsx`) and
// the read-only explore view (`explore-view.tsx`) both render through this. One
// fixed-height row type per line; everything flattens into a single VirtualRows
// (the house pattern — same as HunksView flattening hunks) at 20px each.
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

/** The scrollable body: flattens a FeatureReading into one virtualized 20px-row list. */
export function ReadingSurfaceBody({ reading }: { reading: FeatureReading }): React.JSX.Element {
  const highlighter = useHighlighter()
  const rows = useMemo(() => buildRows(reading, highlighter), [reading, highlighter])
  return (
    <VirtualRows
      rows={rows}
      className="text-xs"
      renderRow={(row) => <ReadingRowView row={row} />}
    />
  )
}
