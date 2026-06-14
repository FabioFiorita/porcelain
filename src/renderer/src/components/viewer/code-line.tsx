import { getHighlighter, type HIGHLIGHT_THEME, tokenizeLines } from '@renderer/lib/highlight'
import { useEffect, useMemo, useState } from 'react'
import type { BundledLanguage, HighlighterGeneric, ThemedToken } from 'shiki'

type Highlighter = HighlighterGeneric<BundledLanguage, typeof HIGHLIGHT_THEME>

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
  return useMemo(
    () => (highlighter && lang ? tokenizeLines(highlighter, content, lang) : null),
    [highlighter, lang, content],
  )
}

export function CodeLine({
  tokens,
  text,
}: {
  /** Pre-tokenized spans for this line, or null to render plain text. */
  tokens: ThemedToken[] | null
  /** Raw line text — the fallback when `tokens` is null/empty (and the blank-line spacer). */
  text: string
}): React.JSX.Element {
  if (!tokens || tokens.length === 0) {
    return <pre className="flex-1 whitespace-pre">{text || ' '}</pre>
  }

  return (
    <pre className="flex-1 whitespace-pre">
      {tokens.map((token, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: tokens are static per line
        <span key={i} style={{ color: token.color }}>
          {token.content}
        </span>
      ))}
    </pre>
  )
}
