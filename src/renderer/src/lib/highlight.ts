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

export function tokenizeLine(
  highlighter: Highlighter,
  text: string,
  lang: BundledLanguage,
): ThemedToken[] {
  return highlighter.codeToTokensBase(text, { lang, theme: HIGHLIGHT_THEME })[0] ?? []
}
