import { useEffect, useState } from 'react'
import type { ColorSchemeName } from 'react-native'

import { type RowTokenizer, shikiRowTokenizer } from '@/features/changes/lib/highlight'
import { getHighlighter, shikiThemeName } from '@/features/changes/lib/shiki-highlighter'

/**
 * The diff surface's tokenizer for the current appearance. Resolves to `undefined` while the
 * highlighter is still loading, and whenever the native engine isn't linked — DiffSurface's
 * documented "no tokenizer" path, not a degraded one.
 */
export function useDiffTokenizer(scheme: ColorSchemeName): RowTokenizer | undefined {
  const theme = shikiThemeName(scheme === 'dark' ? 'dark' : 'light')
  const [tokenizer, setTokenizer] = useState<RowTokenizer | undefined>(undefined)

  useEffect(() => {
    const highlighter = getHighlighter()
    if (highlighter === undefined) return

    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const loaded = await highlighter
        if (!cancelled) setTokenizer(shikiRowTokenizer(loaded, theme))
      } catch (error) {
        // Leave the tokenizer unset: the documented "no tokenizer" path, not a broken screen.
        // `getHighlighter` has already dropped its cache, so the next mount retries clean.
        if (!cancelled) console.warn('[diff-tokenizer] highlighter failed to load', error)
      }
    }
    load()

    return (): void => {
      cancelled = true
    }
  }, [theme])

  return tokenizer
}
