import type { ReviewComment } from '@backend/comment-store'
import { LineDecorations } from '@renderer/components/git/comment-marker'
import { CodeLine, useTokenizedLines } from '@renderer/components/viewer/code-line'
import { VirtualRows } from '@renderer/components/viewer/virtual-rows'
import { languageFor } from '@renderer/lib/highlight'
import { cn } from '@renderer/lib/utils'

export function SourceView({
  path,
  content,
  highlightLine,
  commentsByLine,
}: {
  path: string
  content: string
  highlightLine?: number
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
        const comments = commentsByLine?.get(i + 1)
        return (
          <div
            data-line={i + 1}
            className={cn('relative flex', i + 1 === highlightLine && 'bg-primary/15')}
          >
            <LineDecorations comments={comments} />
            <span className="w-10 shrink-0 select-none pr-3 text-right text-muted-foreground/50">
              {i + 1}
            </span>
            <CodeLine tokens={tokenLines?.[i] ?? null} text={line} />
          </div>
        )
      }}
    />
  )
}
