import { useEffect, useState } from 'react'
import type { ColorSchemeName } from 'react-native'

import { type RowTokenizer, shikiRowTokenizer } from '@/features/changes/lib/highlight'
import { getHighlighter, shikiThemeName } from '@/features/changes/lib/shiki-highlighter'

/**
 * The diff surface's tokenizer for the current appearance. It stays unset while the current
 * client's native highlighter is loading or if that build fails, so the canvas can still paint
 * plain rows while the error is visible in logs.
 */
export function useDiffTokenizer(scheme: ColorSchemeName): RowTokenizer | undefined {
  const theme = shikiThemeName(scheme === 'dark' ? 'dark' : 'light')
  const [tokenizer, setTokenizer] = useState<RowTokenizer | undefined>(undefined)

  useEffect(() => {
    const highlighter = getHighlighter()

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
