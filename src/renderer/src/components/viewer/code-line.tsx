import { getHighlighter, type HIGHLIGHT_THEME, tokenizeLine } from '@renderer/lib/highlight'
import { useEffect, useState } from 'react'
import type { BundledLanguage, HighlighterGeneric } from 'shiki'

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

export function CodeLine({
  text,
  lang,
  highlighter,
}: {
  text: string
  lang: BundledLanguage | null
  highlighter: Highlighter | null
}): React.JSX.Element {
  if (!lang || !highlighter || text === '') {
    return <pre className="flex-1 whitespace-pre">{text || ' '}</pre>
  }

  return (
    <pre className="flex-1 whitespace-pre">
      {tokenizeLine(highlighter, text, lang).map((token, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: tokens are static per line
        <span key={i} style={{ color: token.color }}>
          {token.content}
        </span>
      ))}
    </pre>
  )
}
