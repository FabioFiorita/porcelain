import { memo } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { ThemedToken } from 'shiki'

import { isLineInRange, type LineRange } from '@/features/comments/line-range'
import { cn } from '@/lib/utils'

import type { SourceRow } from './source-rows'

export type SourceLineContext = {
  /** Syntax spans per 1-based line. `null` renders every line in the plain foreground. */
  tokens: ThemedToken[][] | null
  /** Stable path-derived prefix for the source-line accessibility targets. */
  testIDPrefix: string
  /** Lines carrying a review comment, so the row can show its marker. */
  commentedLines: ReadonlySet<number>
  /** The range being selected in this file, or null when nothing is selected. */
  selected: LineRange | null
  /**
   * The line the viewer was opened at — a search hit. Tinted so the reader can see which line
   * the jump was for; distinct from `selected`, which is a comment anchor being drawn.
   */
  focusedLine: number | null
  /** Long-press anchors a selection on this line. */
  onAnchorLine: (line: number) => void
  /** Tap extends the open selection to this line. */
  onExtendToLine: (line: number) => void
}

/**
 * One source line, painted the way the diff paints its own — same gutter width, same mono
 * scale, same comment marker — so a file read straight and the same file read as a diff are
 * recognisably one viewer.
 *
 * Long lines wrap rather than scroll: a phone has no horizontal room, and a viewer you have to
 * pan sideways is a viewer you stop reading.
 */
function SourceLineImpl({
  ctx,
  row,
}: {
  ctx: SourceLineContext
  row: SourceRow
}): React.JSX.Element {
  const commented = ctx.commentedLines.has(row.line)
  const selected = isLineInRange(ctx.selected, row.line)
  const focused = ctx.focusedLine === row.line
  const tokens = ctx.tokens?.[row.line - 1]

  return (
    <Pressable
      accessibilityLabel={`Line ${row.line}${commented ? ', commented' : ''}${
        focused ? ', search match' : ''
      }`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'flex-row gap-1.5 px-2 py-px',
        selected ? 'bg-primary/15' : focused ? 'bg-warning/20' : commented ? 'bg-info/10' : '',
      )}
      testID={`${ctx.testIDPrefix}-${row.line}`}
      onLongPress={() => {
        ctx.onAnchorLine(row.line)
      }}
      onPress={() => {
        ctx.onExtendToLine(row.line)
      }}
    >
      <Text className="w-9 shrink-0 text-right font-mono text-3xs leading-4 text-muted-foreground/60">
        {row.line}
      </Text>
      {commented ? <View className="mt-1 size-1.5 shrink-0 rounded-full bg-info" /> : null}
      <LineText text={row.text} tokens={tokens} />
    </Pressable>
  )
}

/**
 * The line's syntax spans as nested `Text`, so the whole line stays one wrapping run — sibling
 * views would break at a token boundary instead of at a sensible column.
 */
function LineText({
  text,
  tokens,
}: {
  text: string
  tokens: ThemedToken[] | undefined
}): React.JSX.Element {
  const base = 'min-w-0 flex-1 font-mono text-2xs leading-4 text-foreground'
  if (tokens === undefined || tokens.length === 0) {
    // An empty line still needs a glyph or the row collapses to zero height.
    return <Text className={base}>{text === '' ? ' ' : text}</Text>
  }

  // Spans tile the line left to right, so a span's start column is its stable identity —
  // unlike its index, which shifts when the grammar re-splits the line.
  let column = 0
  const spans = tokens.map((token) => {
    const start = column
    column += token.content.length
    return { color: token.color, content: token.content, start }
  })

  return (
    <Text className={base}>
      {spans.map((span) => (
        // nativewind-allow-style: token colours are theme data from Shiki, not classes.
        <Text key={span.start} style={span.color === undefined ? undefined : { color: span.color }}>
          {span.content}
        </Text>
      ))}
    </Text>
  )
}

/** Memoized per row: a watched file re-renders whole whenever the agent touches it. */
export const SourceLine = memo(SourceLineImpl)
