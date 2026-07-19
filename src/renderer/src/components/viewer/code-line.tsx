import { useResolvedTheme } from '@renderer/hooks/use-theme'
import {
  getHighlighter,
  type Highlighter,
  isTokenizable,
  themeNameFor,
  tokenizeLines,
} from '@renderer/lib/highlight'
import { cn } from '@renderer/lib/utils'
import { type CharRange, splitByRanges } from '@renderer/lib/word-diff'
import { useEffect, useMemo, useState } from 'react'
import type { BundledLanguage, ThemedToken } from 'shiki'

export function useHighlighter(): Highlighter | null {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null)

  useEffect(() => {
    let stale = false
    getHighlighter().then((h) => {
      if (!stale) setHighlighter(h)
    })
    return () => {
      stale = true
    }
  }, [])

  return highlighter
}

/**
 * Tokenize a whole file's content into per-line token arrays (one entry per
 * line), memoized on content + lang. Whole-file tokenization is what keeps
 * multiline comments/strings highlighted correctly — see `tokenizeLines`.
 * Returns null until the highlighter loads or when the language is unknown, in
 * which case `CodeLine` falls back to plain text.
 */
export function useTokenizedLines(
  content: string,
  lang: BundledLanguage | null,
): ThemedToken[][] | null {
  const highlighter = useHighlighter()
  const theme = themeNameFor(useResolvedTheme())
  return useMemo(
    () =>
      highlighter && lang && isTokenizable(content)
        ? tokenizeLines(highlighter, content, lang, theme)
        : null,
    [highlighter, lang, content, theme],
  )
}

export function CodeLine({
  tokens,
  text,
  emphasis,
}: {
  /** Pre-tokenized spans for this line, or null to render plain text. */
  tokens: ThemedToken[] | null
  /** Raw line text — the fallback when `tokens` is null/empty (and the blank-line spacer). */
  text: string
  /** Intra-line word-diff highlight: character ranges to emphasize + the bg class to apply. */
  emphasis?: { ranges: readonly CharRange[]; className: string }
}): React.JSX.Element {
  const ranges = emphasis?.ranges
  // Plain text with nothing to emphasize keeps its bare <pre> (also the blank-line spacer).
  if ((!tokens || tokens.length === 0) && !ranges?.length) {
    return <pre className="flex-1 whitespace-pre">{text || ' '}</pre>
  }

  const base =
    tokens && tokens.length > 0
      ? tokens.map((t) => ({ content: t.content, color: t.color }))
      : [{ content: text }]
  const segments = ranges?.length
    ? splitByRanges(base, ranges)
    : base.map((s) => ({ ...s, emphasized: false }))

  return (
    <pre className="flex-1 whitespace-pre">
      {segments.map((seg, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are static per line
          key={i}
          style={seg.color ? { color: seg.color } : undefined}
          className={cn(seg.emphasized && emphasis?.className)}
        >
          {seg.content}
        </span>
      ))}
    </pre>
  )
}
