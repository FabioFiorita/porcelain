import type { TokenMap } from '@porcelain/client-runtime/highlight'
import { formatHunkHeader } from '@porcelain/client-runtime/hunk-header'
import { type CharRange, splitByRanges } from '@porcelain/client-runtime/word-diff-line'
import type { DiffHunk } from '@porcelain/contracts/git'
import { memo } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { ThemedToken } from 'shiki'
import { isLineInRange, type LineRange } from '@/features/comments'
import { cn } from '@/lib/utils'
import { anchorLineOf, cellAnchorLine, type DiffRow } from './diff-rows'

type DiffLine = DiffHunk['lines'][number]

/** Line fill by kind. Long lines wrap rather than scroll — a phone has no horizontal room. */
const LINE_CLASS: Record<DiffLine['kind'], string> = {
  add: 'bg-diff-add',
  context: '',
  del: 'bg-diff-del',
}

/** Stronger fill for the changed words inside a line, painted over the line's own fill. */
const EMPHASIS_CLASS: Record<DiffLine['kind'], string> = {
  add: 'bg-diff-add-emphasis',
  context: '',
  del: 'bg-diff-del-emphasis',
}

export type DiffLineContext = {
  /** Intra-line changed ranges, keyed by line identity (see `intraLineEmphasis`). */
  emphasis: Map<DiffLine, CharRange[]>
  /** Syntax spans per line, keyed the same way. Empty until the highlighter loads. */
  tokens: TokenMap
  /** New-side lines that carry a comment, so the row can show its marker. */
  isCommented: (line: number, side: 'old' | 'new') => boolean
  /** The line range being selected in THIS file, or null when the selection is elsewhere. */
  selected: LineRange | null
  /** Long-press anchors a selection on this line. */
  onAnchorLine: (line: number, side: 'old' | 'new') => void
  /** Tap extends the open selection to this line. */
  onExtendToLine: (line: number, side: 'old' | 'new') => void
}

function LineNumber({ value }: { value: number | null }): React.JSX.Element {
  return (
    <Text className="w-9 shrink-0 text-right font-mono text-3xs leading-4 text-muted-foreground/60">
      {value ?? ''}
    </Text>
  )
}

/**
 * The line's syntax spans with its changed words emphasized over them. Rendered as nested
 * `Text` so the whole line stays one wrapping text run — sibling views would break at a
 * token boundary instead of at a sensible column.
 *
 * Token colours come from the same VS Code theme the web viewer paints, so a diff read on
 * the phone and the same diff on the desktop are the same picture.
 */
function LineText({
  emphasis,
  line,
  tokens,
}: {
  emphasis: CharRange[] | undefined
  line: DiffLine
  tokens: ThemedToken[] | undefined
}): React.JSX.Element {
  const base = 'min-w-0 flex-1 font-mono text-2xs leading-4 text-foreground'
  const hasTokens = tokens !== undefined && tokens.length > 0
  const hasEmphasis = emphasis !== undefined && emphasis.length > 0
  if (!hasTokens && !hasEmphasis) {
    return <Text className={base}>{line.text === '' ? ' ' : line.text}</Text>
  }

  const parts = hasTokens
    ? tokens.map((token) => ({ color: token.color, content: token.content }))
    : [{ color: undefined, content: line.text }]
  // Spans tile the line left to right, so a span's start column is its stable identity —
  // unlike its position in the array, which shifts as the ranges move.
  let column = 0
  const spans = (
    hasEmphasis ? splitByRanges(parts, emphasis) : parts.map((p) => ({ ...p, emphasized: false }))
  ).map((span) => {
    const start = column
    column += span.content.length
    return { ...span, start }
  })

  return (
    <Text className={base}>
      {spans.map((span) => (
        <Text
          key={span.start}
          // `undefined`, never `''`: an empty className still hands the element to
          // react-native-css, which then resolves a style of its own and drops the inline
          // token colour — the span renders in the inherited foreground instead.
          className={span.emphasized ? EMPHASIS_CLASS[line.kind] : undefined}
          // nativewind-allow-style: token colours are theme data from Shiki, not classes.
          style={span.color === undefined ? undefined : { color: span.color }}
        >
          {span.content}
        </Text>
      ))}
    </Text>
  )
}

/** A comment marker in the gutter — the mobile stand-in for the web's line decoration. */
function CommentMarker(): React.JSX.Element {
  return <View className="mt-1 size-1.5 shrink-0 rounded-full bg-info" />
}

function UnifiedRow({ ctx, line }: { ctx: DiffLineContext; line: DiffLine }): React.JSX.Element {
  const anchor = anchorLineOf(line)
  const side = line.kind === 'del' ? 'old' : 'new'
  const commented = anchor !== undefined && ctx.isCommented(anchor, side)
  const selected = isLineInRange(ctx.selected, anchor)
  return (
    <Pressable
      accessibilityLabel={
        anchor === undefined ? line.text : `Line ${anchor}${commented ? ', commented' : ''}`
      }
      accessibilityRole="text"
      accessibilityState={{ selected }}
      className={cn(
        'flex-row gap-1.5 px-2 py-px',
        selected ? 'bg-primary/15' : commented ? 'bg-info/10' : LINE_CLASS[line.kind],
      )}
      onLongPress={() => {
        if (anchor !== undefined) ctx.onAnchorLine(anchor, side)
      }}
      onPress={() => {
        if (anchor !== undefined) ctx.onExtendToLine(anchor, side)
      }}
    >
      <LineNumber value={line.oldLine} />
      <LineNumber value={line.newLine} />
      {commented ? <CommentMarker /> : null}
      <LineText emphasis={ctx.emphasis.get(line)} line={line} tokens={ctx.tokens.get(line)} />
    </Pressable>
  )
}

function SplitCell({
  ctx,
  line,
  side,
}: {
  ctx: DiffLineContext
  line: DiffLine | null
  side: 'left' | 'right'
}): React.JSX.Element {
  const anchor = line === null ? undefined : cellAnchorLine(line, side)
  const anchorSide = side === 'left' ? 'old' : 'new'
  const commented = anchor !== undefined && ctx.isCommented(anchor, anchorSide)
  const selected = isLineInRange(ctx.selected, anchor)
  return (
    <Pressable
      accessibilityState={{ selected }}
      className={cn(
        'min-w-0 flex-1 flex-row gap-1.5 px-2 py-px',
        selected
          ? 'bg-primary/15'
          : commented
            ? 'bg-info/10'
            : line === null
              ? ''
              : LINE_CLASS[line.kind],
      )}
      onLongPress={() => {
        if (anchor !== undefined) ctx.onAnchorLine(anchor, side === 'left' ? 'old' : 'new')
      }}
      onPress={() => {
        if (anchor !== undefined) ctx.onExtendToLine(anchor, side === 'left' ? 'old' : 'new')
      }}
    >
      <LineNumber
        value={line === null ? null : line.kind === 'add' ? line.newLine : line.oldLine}
      />
      {commented ? <CommentMarker /> : null}
      {line === null ? (
        <Text className="min-w-0 flex-1"> </Text>
      ) : (
        <LineText emphasis={ctx.emphasis.get(line)} line={line} tokens={ctx.tokens.get(line)} />
      )}
    </Pressable>
  )
}

function DiffRowViewImpl({ ctx, row }: { ctx: DiffLineContext; row: DiffRow }): React.JSX.Element {
  if (row.kind === 'header') {
    return (
      <View className="bg-muted/50 px-2 py-0.5">
        <Text className="font-mono text-3xs leading-4 text-muted-foreground" numberOfLines={1}>
          {formatHunkHeader(row.text)}
        </Text>
      </View>
    )
  }
  if (row.kind === 'unified') {
    return <UnifiedRow ctx={ctx} line={row.line} />
  }
  return (
    <View className="flex-row">
      <SplitCell ctx={ctx} line={row.left} side="left" />
      <View className="w-px self-stretch bg-border" />
      <SplitCell ctx={ctx} line={row.right} side="right" />
    </View>
  )
}

/** Memoized per row: the working diff re-polls every few seconds while you read it. */
export const DiffRowView = memo(DiffRowViewImpl)
