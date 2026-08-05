import { getHighlighter, type Highlighter } from '@porcelain/client-runtime/highlight'
import { useEffect, useState } from 'react'

/**
 * The shared Shiki highlighter, loaded once per process.
 *
 * Same grammars and VS Code themes the web viewer uses (`@porcelain/client-runtime/highlight`),
 * on the JavaScript regex engine — the WASM engine has no Hermes host. `null` until it
 * resolves, and every caller falls back to plain monospace until then.
 *
 * Lives outside any feature folder because both code surfaces need it: the diff tokenizes
 * hunks, the file viewer tokenizes whole files, and a second loader would mean a second
 * copy of every grammar in memory.
 */
export function useHighlighter(): Highlighter | null {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null)

  useEffect(() => {
    let stale = false
    // Hermes' RegExp is not V8's: `oniguruma-to-es` targets ES2018 (no `v` flag) and a
    // pattern it still cannot compile is skipped rather than thrown, so one awkward grammar
    // costs that construct's colour instead of the whole file.
    getHighlighter({ forgiving: true, target: 'ES2018' })
      .then((loaded) => {
        if (!stale) setHighlighter(loaded)
      })
      .catch((cause: unknown) => {
        // A grammar the engine cannot compile must not take the viewer down with it: the
        // code stays readable unhighlighted. Logged, because a silent fallback to plain
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
