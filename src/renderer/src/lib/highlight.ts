import {
  type BundledLanguage,
  createHighlighter,
  createJavaScriptRegexEngine,
  type HighlighterGeneric,
  type ThemedToken,
} from 'shiki'

export const HIGHLIGHT_THEME = 'dark-plus'

const LANGS = [
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'json',
  'css',
  'html',
  'markdown',
  'yaml',
  'shellscript',
  'swift',
] as const satisfies readonly BundledLanguage[]

type Highlighter = HighlighterGeneric<BundledLanguage, typeof HIGHLIGHT_THEME>

let highlighterPromise: Promise<Highlighter> | null = null

export function getHighlighter(): Promise<Highlighter> {
  // JS regex engine: the renderer CSP (no 'wasm-unsafe-eval') blocks the default WASM engine
  highlighterPromise ??= createHighlighter({
    themes: [HIGHLIGHT_THEME],
    langs: [...LANGS],
    engine: createJavaScriptRegexEngine(),
  }) as Promise<Highlighter>
  return highlighterPromise
}

const extToLang: Record<string, BundledLanguage> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  json: 'json',
  css: 'css',
  html: 'html',
  md: 'markdown',
  yaml: 'yaml',
  yml: 'yaml',
  sh: 'shellscript',
  zsh: 'shellscript',
  bash: 'shellscript',
  swift: 'swift',
}

export function languageFor(path: string): BundledLanguage | null {
  const ext = path.split('.').at(-1)?.toLowerCase() ?? ''
  return extToLang[ext] ?? null
}

/**
 * Files with more lines than this cap are not syntax-highlighted. Whole-file
 * tokenization runs synchronously on the renderer main thread via the JS regex
 * engine (the CSP blocks the faster WASM engine), so very large generated files
 * (lockfiles, schema dumps, bundled JS) block the UI for hundreds of ms to
 * seconds. Above this threshold `isTokenizable` returns false and callers fall
 * back to plain text — still fully readable, just unhighlighted.
 */
export const MAX_TOKENIZE_LINES = 10_000

/** Maximum byte length before we bail out regardless of line count (catches
 * pathological minified single-line files that slip under the line cap). */
const MAX_TOKENIZE_BYTES = 2 * 1024 * 1024 // 2 MB

/**
 * Returns true when `content` is small enough to tokenize without janking the
 * renderer. Pure function — no Shiki dependency, safe to call before the
 * highlighter loads.
 *
 * Counts `\n` occurrences with an index loop rather than `split('\n')` so we
 * don't allocate a giant array for the very large files we're protecting.
 */
export function isTokenizable(content: string): boolean {
  if (content.length > MAX_TOKENIZE_BYTES) return false
  let newlines = 0
  let idx = content.indexOf('\n')
  while (idx !== -1) {
    newlines++
    if (newlines > MAX_TOKENIZE_LINES) return false
    idx = content.indexOf('\n', idx + 1)
  }
  return true
}

/**
 * Tokenize a whole multi-line string into one token array per line, carrying
 * grammar state across line breaks. Tokenizing line-by-line (the old approach)
 * loses that state, so continuation lines of a multiline block comment or
 * template literal were highlighted as code. The returned array has exactly one
 * entry per `\n`-split line, so callers can index it by line number.
 */
/**
 * Bounded LRU over whole-file tokenization. The viewer mounts only the ACTIVE
 * tab, so a component-local `useMemo` is discarded when you switch away — and
 * revisiting re-pays the full synchronous tokenization for identical content.
 * A module-level cache survives unmounts (the terminal registry solves the same
 * lifecycle problem the same way). Keyed on `${lang} ${code}` so a `.ts` and a
 * `.js` file sharing content don't collide. 8 entries bounds worst-case
 * retained tokens (content ≤ 2 MB by the `isTokenizable` guard) — don't raise
 * it without a memory look. Returned arrays are shared and treated as immutable
 * by every caller (consumers only read/index).
 */
const TOKEN_CACHE_MAX = 8
const tokenCache = new Map<string, ThemedToken[][]>()

export function tokenizeLines(
  highlighter: Highlighter,
  code: string,
  lang: BundledLanguage,
): ThemedToken[][] {
  const key = `${lang} ${code}`
  const hit = tokenCache.get(key)
  if (hit) {
    // Re-insert to mark most-recently-used (Map preserves insertion order).
    tokenCache.delete(key)
    tokenCache.set(key, hit)
    return hit
  }
  const tokens = highlighter.codeToTokensBase(code, { lang, theme: HIGHLIGHT_THEME })
  tokenCache.set(key, tokens)
  if (tokenCache.size > TOKEN_CACHE_MAX) {
    const oldest = tokenCache.keys().next().value
    if (oldest !== undefined) tokenCache.delete(oldest)
  }
  return tokens
}
