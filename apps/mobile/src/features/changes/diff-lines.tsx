import { type CharRange, splitByRanges } from '@porcelain/client-runtime/word-diff-line'
import { memo } from 'react'
import { Pressable, Text, View } from 'react-native'

import type { DiffHunk } from '@/lib/daemon/procedures/changes'
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
  /** New-side lines that carry a comment, so the row can show its marker. */
  commentedLines: ReadonlySet<number>
  /** Long-press a line to comment on it. */
  onCommentLine: (line: number) => void
}

function LineNumber({ value }: { value: number | null }): React.JSX.Element {
  return (
    <Text className="w-9 shrink-0 text-right font-mono text-[10px] leading-4 text-muted-foreground/60">
      {value ?? ''}
    </Text>
  )
}

/**
 * The line's text with its changed words emphasized. Rendered as nested `Text` so the whole
 * line stays one wrapping text run — splitting it into sibling views would break at the
 * emphasis boundary instead of at a sensible column.
 */
function LineText({
  emphasis,
  line,
}: {
  emphasis: CharRange[] | undefined
  line: DiffLine
}): React.JSX.Element {
  const base = 'min-w-0 flex-1 font-mono text-[11px] leading-4 text-foreground'
  if (emphasis === undefined || emphasis.length === 0) {
    return <Text className={base}>{line.text === '' ? ' ' : line.text}</Text>
  }
  // Spans tile the line left to right, so a span's start column is its stable identity —
  // unlike its position in the array, which shifts as the emphasis ranges move.
  let column = 0
  const spans = splitByRanges([{ content: line.text }], emphasis).map((span) => {
    const start = column
    column += span.content.length
    return { ...span, start }
  })
  return (
    <Text className={base}>
      {spans.map((span) => (
        <Text key={span.start} className={cn(span.emphasized && EMPHASIS_CLASS[line.kind])}>
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
  const commented = anchor !== undefined && ctx.commentedLines.has(anchor)
  return (
    <Pressable
      accessibilityLabel={
        anchor === undefined ? line.text : `Line ${anchor}${commented ? ', commented' : ''}`
      }
      accessibilityRole="text"
      className={cn(
        'flex-row gap-1.5 px-2 py-px',
        commented ? 'bg-info/10' : LINE_CLASS[line.kind],
      )}
      onLongPress={() => {
        if (anchor !== undefined) ctx.onCommentLine(anchor)
      }}
    >
      <LineNumber value={line.oldLine} />
      <LineNumber value={line.newLine} />
      {commented ? <CommentMarker /> : null}
      <LineText emphasis={ctx.emphasis.get(line)} line={line} />
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
  const commented = anchor !== undefined && ctx.commentedLines.has(anchor)
  return (
    <Pressable
      className={cn(
        'min-w-0 flex-1 flex-row gap-1.5 px-2 py-px',
        commented ? 'bg-info/10' : line === null ? '' : LINE_CLASS[line.kind],
      )}
      onLongPress={() => {
        if (anchor !== undefined) ctx.onCommentLine(anchor)
      }}
    >
      <LineNumber
        value={line === null ? null : line.kind === 'add' ? line.newLine : line.oldLine}
      />
      {commented ? <CommentMarker /> : null}
      {line === null ? (
        <Text className="min-w-0 flex-1"> </Text>
      ) : (
        <LineText emphasis={ctx.emphasis.get(line)} line={line} />
      )}
    </Pressable>
  )
}

function DiffRowViewImpl({ ctx, row }: { ctx: DiffLineContext; row: DiffRow }): React.JSX.Element {
  if (row.kind === 'header') {
    return (
      <View className="bg-muted/50 px-2 py-0.5">
        <Text className="font-mono text-[10px] leading-4 text-muted-foreground" numberOfLines={1}>
          {row.text}
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
