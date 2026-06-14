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
}

export function languageFor(path: string): BundledLanguage | null {
  const ext = path.split('.').at(-1)?.toLowerCase() ?? ''
  return extToLang[ext] ?? null
}

/**
 * Tokenize a whole multi-line string into one token array per line, carrying
 * grammar state across line breaks. Tokenizing line-by-line (the old approach)
 * loses that state, so continuation lines of a multiline block comment or
 * template literal were highlighted as code. The returned array has exactly one
 * entry per `\n`-split line, so callers can index it by line number.
 */
export function tokenizeLines(
  highlighter: Highlighter,
  code: string,
  lang: BundledLanguage,
): ThemedToken[][] {
  return highlighter.codeToTokensBase(code, { lang, theme: HIGHLIGHT_THEME })
}
