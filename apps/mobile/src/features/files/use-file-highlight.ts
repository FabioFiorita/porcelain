import {
  isTokenizable,
  languageFor,
  themeNameFor,
  tokenizeLines,
} from '@porcelain/client-runtime/highlight'
import { useMemo } from 'react'
import type { ThemedToken } from 'shiki'

import { useResolvedColorScheme } from '@/features/settings/theme-provider'
import { useHighlighter } from '@/lib/highlight'

/** Syntax spans per 1-based line, or `null` while the file renders as plain monospace. */
export type SourceTokens = ThemedToken[][] | null

/**
 * A whole file's syntax spans, in the same VS Code theme the web viewer paints.
 *
 * Tokenized as one document rather than line by line, so grammar state — an open block
 * comment, a template literal, a fenced code block in markdown — survives the line breaks it
 * spans. `client-runtime` caches the result, so a theme flip or a scroll back to a file
 * already read costs a lookup.
 *
 * `null` in three cases, all of which render as readable plain text: the highlighter has not
 * loaded yet, the extension has no grammar in our fine-grained bundle, or the file is past the
 * size where synchronous tokenization would block the JS thread (`isTokenizable`).
 */
export function useSourceTokens(path: string, content: string): SourceTokens {
  const highlighter = useHighlighter()
  const theme = themeNameFor(useResolvedColorScheme())

  return useMemo(() => {
    if (highlighter === null) return null
    const lang = languageFor(path)
    if (lang === null || !isTokenizable(content)) return null
    return tokenizeLines(highlighter, content, lang, theme)
  }, [content, highlighter, path, theme])
}
