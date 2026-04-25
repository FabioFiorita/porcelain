import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { CodeLine, useHighlighter } from '@renderer/components/viewer/code-line'
import { type HIGHLIGHT_THEME, languageFor } from '@renderer/lib/highlight'
import { trpc } from '@renderer/lib/trpc'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import type { BundledLanguage, HighlighterGeneric } from 'shiki'
import type { DiffHunk, DiffLine } from '../../../../main/diff'

type Highlighter = HighlighterGeneric<BundledLanguage, typeof HIGHLIGHT_THEME>

interface RenderContext {
  lang: BundledLanguage | null
  highlighter: Highlighter | null
}

const lineClass: Record<DiffLine['kind'], string> = {
  add: 'bg-emerald-950/60',
  del: 'bg-red-950/60',
  context: '',
}

function LineNo({ value }: { value: number | null }): React.JSX.Element {
  return (
    <span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground/60">
      {value ?? ''}
    </span>
  )
}

function UnifiedHunk({ hunk, ctx }: { hunk: DiffHunk; ctx: RenderContext }): React.JSX.Element {
  return (
    <div>
      <p className="bg-muted/40 px-2 py-0.5 text-muted-foreground">{hunk.header}</p>
      {hunk.lines.map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: diff lines are static per hunk
        <div key={i} className={cn('flex px-2', lineClass[line.kind])}>
          <LineNo value={line.oldLine} />
          <LineNo value={line.newLine} />
          <CodeLine text={line.text} lang={ctx.lang} highlighter={ctx.highlighter} />
        </div>
      ))}
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
    <div className={cn('flex min-w-0 flex-1', line ? lineClass[line.kind] : '')}>
      <LineNo value={line ? (line.kind === 'add' ? line.newLine : line.oldLine) : null} />
      {line ? (
        <CodeLine text={line.text} lang={ctx.lang} highlighter={ctx.highlighter} />
      ) : (
        <pre className="flex-1"> </pre>
      )}
    </div>
  )
}

function SplitHunk({ hunk, ctx }: { hunk: DiffHunk; ctx: RenderContext }): React.JSX.Element {
  return (
    <div>
      <p className="bg-muted/40 px-2 py-0.5 text-muted-foreground">{hunk.header}</p>
      {toSplitRows(hunk).map((row, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: diff rows are static per hunk
        <div key={i} className="flex divide-x divide-border">
          <SplitCell line={row.left} ctx={ctx} />
          <SplitCell line={row.right} ctx={ctx} />
        </div>
      ))}
    </div>
  )
}

export function DiffView({ filePath }: { filePath: string }): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const setDiffMode = usePreferencesStore((s) => s.setDiffMode)
  const highlighter = useHighlighter()
  const { data: hunks, error } = trpc.gitDiffFile.useQuery(
    { repoPath: repo?.path ?? '', filePath },
    { enabled: repo !== null },
  )

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>
  if (hunks === undefined) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>

  const ctx: RenderContext = { lang: languageFor(filePath), highlighter }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-1">
        <span className="truncate font-mono text-xs text-muted-foreground">{filePath}</span>
        <ToggleGroup
          value={[diffMode]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'unified' || mode === 'split') setDiffMode(mode)
          }}
        >
          <ToggleGroupItem value="unified" size="sm">
            Unified
          </ToggleGroupItem>
          <ToggleGroupItem value="split" size="sm">
            Split
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="font-mono text-xs leading-5">
          {hunks.length === 0 && <p className="p-4 text-muted-foreground">No changes</p>}
          {hunks.map((hunk) => (
            <div key={hunk.header} className="mb-2">
              {diffMode === 'unified' ? (
                <UnifiedHunk hunk={hunk} ctx={ctx} />
              ) : (
                <SplitHunk hunk={hunk} ctx={ctx} />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
