import { CodeLine, useTokenizedLines } from '@renderer/components/viewer/code-line'
import { VirtualRows } from '@renderer/components/viewer/virtual-rows'
import { languageFor } from '@renderer/lib/highlight'
import { type HighlightRange, lineInHighlightRanges } from '@renderer/lib/highlight-ranges'
import { cn } from '@renderer/lib/utils'

export function SourceView({
  path,
  content,
  highlightLine,
  highlightRanges,
}: {
  path: string
  content: string
  highlightLine?: number
  /** Agent-changed lines (Review outline). Diff-token tint, not find highlight. */
  highlightRanges?: HighlightRange[]
}): React.JSX.Element {
  const lang = languageFor(path)
  const lines = content.split('\n')
  const tokenLines = useTokenizedLines(content, lang)

  return (
    <VirtualRows
      rows={lines}
      className="px-4 py-2 leading-5"
      scrollToLine={highlightLine}
      renderRow={(line: string, i: number): React.JSX.Element => {
        const lineNo = i + 1
        const isChanged = lineInHighlightRanges(lineNo, highlightRanges)
        return (
          <div
            data-line={lineNo}
            className={cn(
              'relative flex',
              lineNo === highlightLine && 'bg-primary/15',
              isChanged && 'border-l-2 border-l-diff-add bg-diff-add/10',
            )}
          >
            <span className="w-10 shrink-0 select-none pr-3 text-right text-muted-foreground/50">
              {lineNo}
            </span>
            <CodeLine tokens={tokenLines?.[i] ?? null} text={line} />
          </div>
        )
      }}
    />
  )
}
