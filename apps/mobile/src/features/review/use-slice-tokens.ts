import {
  type Highlighter,
  type HighlightThemeName,
  languageFor,
  themeNameFor,
  tokenizeLines,
} from '@porcelain/client-runtime/highlight'
import { useMemo } from 'react'
import type { ThemedToken } from 'shiki'

import { useResolvedColorScheme } from '@/features/settings/theme-provider'
import type { SliceRange } from '@/lib/daemon/procedures/review'
import { useHighlighter } from '@/lib/highlight'

/**
 * Past this many sliced lines in one file, the file renders plain. Tokenizing is synchronous
 * and costs milliseconds per file; a whole-file fallback slice must not block the frame.
 */
const MAX_HIGHLIGHT_LINES = 4_000

/**
 * Syntax spans for a context or shipped file's symbol slices, indexed by 1-based line so a
 * `SourceLine` can look its own line up.
 *
 * Each range is tokenized on its own, the way the desktop does it: a slice is contiguous
 * source, but two slices are not, and joining them would carry an unclosed block comment
 * across a gap and mis-colour everything after it. The array is sparse — only the lines the
 * daemon actually sent have entries — which is exactly what `SourceLine` reads.
 */
export function useSliceTokens(): (
  path: string,
  ranges: readonly SliceRange[],
) => ThemedToken[][] | null {
  const highlighter = useHighlighter()
  const theme = themeNameFor(useResolvedColorScheme())

  // Keyed by highlighter + theme: a theme flip must retint, and a cache from before the
  // highlighter loaded holds nothing worth keeping.
  return useMemo(() => cachedSliceTokenizer(highlighter, theme), [highlighter, theme])
}

function cachedSliceTokenizer(
  highlighter: Highlighter | null,
  theme: HighlightThemeName,
): (path: string, ranges: readonly SliceRange[]) => ThemedToken[][] | null {
  // Keyed by the ranges array rather than the path: a poll hands back new objects for a file
  // whose slices moved, and React Query's structural sharing keeps identity for everything
  // that did not — so this stays correct without a manual invalidation, and a WeakMap drops
  // the entry as soon as the reading that owned it is replaced.
  const cache = new WeakMap<readonly SliceRange[], ThemedToken[][] | null>()

  return (path: string, ranges: readonly SliceRange[]): ThemedToken[][] | null => {
    if (highlighter === null || ranges.length === 0) return null
    const cached = cache.get(ranges)
    if (cached !== undefined) return cached

    const lang = languageFor(path)
    const total = ranges.reduce((count, range) => count + range.lines.length, 0)
    if (lang === null || total > MAX_HIGHLIGHT_LINES) {
      cache.set(ranges, null)
      return null
    }

    const byLine: ThemedToken[][] = []
    for (const range of ranges) {
      const lines = tokenizeLines(highlighter, range.lines.join('\n'), lang, theme)
      lines.forEach((tokens, offset) => {
        byLine[range.startLine + offset - 1] = tokens
      })
    }
    cache.set(ranges, byLine)
    return byLine
  }
}
