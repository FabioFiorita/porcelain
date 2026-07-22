import type { ReviewComment } from '@backend/comment-store'
import { commentRowClass, LineDecorations } from '@renderer/components/git/comment-marker'
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
  commentsByLine,
}: {
  path: string
  content: string
  highlightLine?: number
  /** Agent-changed lines (Feature outline). Diff-token tint, not find highlight. */
  highlightRanges?: HighlightRange[]
  commentsByLine?: Map<number, ReviewComment[]>
}): React.JSX.Element {
  const lang = languageFor(path)
  const lines = content.split('\n')
  const tokenLines = useTokenizedLines(content, lang)

  return (
    <VirtualRows
      rows={lines}
      className="px-4 py-2 leading-5"
      scrollToLine={highlightLine}
      renderRow={(line, i) => {
        const lineNo = i + 1
        const comments = commentsByLine?.get(lineNo)
        // Comment tint wins over changed-line / find-highlight (actionable vs informational).
        const tint = commentRowClass(comments)
        const isChanged = !tint && lineInHighlightRanges(lineNo, highlightRanges)
        return (
          <div
            data-line={lineNo}
            className={cn(
              'relative flex',
              !tint && lineNo === highlightLine && 'bg-primary/15',
              tint,
              isChanged && 'border-l-2 border-l-diff-add bg-diff-add/10',
            )}
          >
            <LineDecorations comments={comments} />
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
