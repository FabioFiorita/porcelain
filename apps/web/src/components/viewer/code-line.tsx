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
import { settleBackground } from '@shared/background'
import { useEffect, useMemo, useState } from 'react'
import type { BundledLanguage, ThemedToken } from 'shiki'

export function useHighlighter(): Highlighter | null {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null)

  useEffect(() => {
    let stale = false
    // Load failure leaves highlighter null — plain text fallback (current UX).
    settleBackground(
      getHighlighter().then((h) => {
        if (!stale) setHighlighter(h)
      }),
      'fallback',
    )
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

/**
 * Soft-wrap classes for a line that must fit the viewport instead of extending it.
 *
 * `whitespace-pre-wrap` keeps every leading space and tab (indentation is meaning in
 * code, so `normal` is never right here) while allowing a break at spaces.
 * `wrap-anywhere` (`overflow-wrap: anywhere`) breaks a token that still doesn't fit —
 * a URL, a base64 blob, a minified line — and, unlike `break-words`, it also drops the
 * token out of the element's MIN-CONTENT width, which is what stops a flex/grid parent
 * from being pushed wide again. `min-w-0` is the other half of that: a `flex-1` item
 * defaults to `min-width: auto`, so without it the long token still wins.
 */
const wrapClass = 'whitespace-pre-wrap wrap-anywhere min-w-0'

export function CodeLine({
  tokens,
  text,
  emphasis,
  wrap = false,
}: {
  /** Pre-tokenized spans for this line, or null to render plain text. */
  tokens: ThemedToken[] | null
  /** Raw line text — the fallback when `tokens` is null/empty (and the blank-line spacer). */
  text: string
  /** Intra-line word-diff highlight: character ranges to emphasize + the bg class to apply. */
  emphasis?: { ranges: readonly CharRange[]; className: string }
  /**
   * Soft-wrap the line to its container instead of running off the right edge. The
   * host row must then measure its own height (a wrapped line is 2+ lines tall) — see
   * `VirtualRows dynamicHeight`. Default false: one line, one row, horizontal scroll.
   */
  wrap?: boolean
}): React.JSX.Element {
  const ranges = emphasis?.ranges
  const lineClass = cn('flex-1', wrap ? wrapClass : 'whitespace-pre')
  // Plain text with nothing to emphasize keeps its bare <pre> (also the blank-line spacer).
  if ((!tokens || tokens.length === 0) && !ranges?.length) {
    return <pre className={lineClass}>{text || ' '}</pre>
  }

  const base =
    tokens && tokens.length > 0
      ? tokens.map((t) => ({ content: t.content, color: t.color }))
      : [{ content: text, color: undefined }]
  const segments = ranges?.length
    ? splitByRanges(base, ranges)
    : base.map((s) => ({ ...s, emphasized: false }))

  return (
    <pre className={lineClass}>
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
