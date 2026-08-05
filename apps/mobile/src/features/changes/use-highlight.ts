import {
  getHighlighter,
  type Highlighter,
  type HighlightThemeName,
  languageFor,
  type TokenMap,
  themeNameFor,
  tokenizeHunks,
} from '@porcelain/client-runtime/highlight'
import { useEffect, useMemo, useState } from 'react'

import { useResolvedColorScheme } from '@/features/settings/theme-provider'
import type { DiffHunk } from '@/lib/daemon/procedures/changes'

const EMPTY_TOKENS: TokenMap = new Map()

/**
 * The shared Shiki highlighter, loaded once per process.
 *
 * Same grammars and VS Code themes the web viewer uses (`@porcelain/client-runtime/highlight`),
 * on the JavaScript regex engine — the WASM engine has no Hermes host. `null` until it
 * resolves, and every caller falls back to plain monospace until then.
 */
export function useHighlighter(): Highlighter | null {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null)

  useEffect(() => {
    let stale = false
    // Hermes' RegExp is not V8's: `oniguruma-to-es` targets ES2018 (no `v` flag) and a
    // pattern it still cannot compile is skipped rather than thrown, so one awkward grammar
    // costs that construct's colour instead of the whole diff.
    getHighlighter({ forgiving: true, target: 'ES2018' })
      .then((loaded) => {
        if (!stale) setHighlighter(loaded)
      })
      .catch((cause: unknown) => {
        // A grammar the engine cannot compile must not take the diff down with it: the
        // viewer stays readable unhighlighted. Logged, because a silent fallback to plain
        // text is indistinguishable from "this file has no grammar".
        console.warn('[porcelain] syntax highlighting unavailable:', cause)
        if (!stale) setHighlighter(null)
      })
    return () => {
      stale = true
    }
  }, [])

  return highlighter
}

/**
 * Tokenizing is synchronous and costs milliseconds per file, so a 60-file read that did it
 * up front would block the first frame for seconds. This caps a single file instead: past
 * this many diff lines the file renders plain, which is still perfectly readable.
 */
const MAX_HIGHLIGHT_LINES = 4_000

function hunkLineCount(hunks: readonly DiffHunk[]): number {
  let count = 0
  for (const hunk of hunks) count += hunk.lines.length
  return count
}

/**
 * Per-file diff tokens, computed on first use and remembered while that diff is on screen.
 *
 * The continuous read stacks every file in the change set, but the list only renders a
 * window of it — so tokenization follows the scroll rather than the file count. Callers ask
 * for a file's tokens while rendering its rows; the first ask pays, the rest are lookups.
 */
export function useDiffTokens(): (path: string, hunks: readonly DiffHunk[]) => TokenMap {
  const highlighter = useHighlighter()
  const theme = themeNameFor(useResolvedColorScheme())

  // Keyed by highlighter + theme: a theme flip must retint, and the cache from before the
  // highlighter loaded holds nothing worth keeping.
  return useMemo(() => cachedTokenizer(highlighter, theme), [highlighter, theme])
}

function cachedTokenizer(
  highlighter: Highlighter | null,
  theme: HighlightThemeName,
): (path: string, hunks: readonly DiffHunk[]) => TokenMap {
  // Keyed by the hunks array rather than the path, because the token map is keyed by line
  // IDENTITY. A poll that changes a file hands back new line objects (React Query's
  // structural sharing keeps identity for everything that did not move), so a path-keyed
  // cache would serve a map whose keys no longer exist and the file would silently lose its
  // colour until remount. A WeakMap also drops entries as the reading is replaced.
  const cache = new WeakMap<readonly DiffHunk[], TokenMap>()
  return (path: string, hunks: readonly DiffHunk[]): TokenMap => {
    if (highlighter === null) return EMPTY_TOKENS
    const cached = cache.get(hunks)
    if (cached !== undefined) return cached
    const lang = languageFor(path)
    const tokens =
      lang === null || hunkLineCount(hunks) > MAX_HIGHLIGHT_LINES
        ? EMPTY_TOKENS
        : tokenizeHunks(highlighter, hunks, lang, theme)
    cache.set(hunks, tokens)
    return tokens
  }
}
