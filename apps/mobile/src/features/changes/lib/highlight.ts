import type { TokenizableLine } from '@/features/changes/lib/canvas-rows'
import type { RowCanvasToken, RowCanvasTokensPatch } from '@/lib/row-canvas/types'

/**
 * Syntax colouring, kept behind one structural seam. The canvas takes styled tokens per row and
 * nothing else, so the highlighter is injected rather than imported: no tokenizer means no
 * patch and plainly coloured code, which is the correct rendering, not a degraded one.
 */
export type RowTokenizer = {
  tokenize: (line: TokenizableLine) => RowCanvasToken[]
}

/** Shiki's `codeToTokensBase` result, described structurally so this module owns no dependency. */
export type ShikiToken = {
  content: string
  color?: string
  fontStyle?: number
}

export type ShikiHighlighter = {
  codeToTokensBase: (code: string, options: { lang: string; theme: string }) => ShikiToken[][]
  getLoadedLanguages: () => string[]
}

/** Shiki's `FontStyle` bitfield. */
const ITALIC = 1
const BOLD = 2

const LANGUAGES: Record<string, string> = {
  cjs: 'javascript',
  css: 'css',
  go: 'go',
  html: 'html',
  js: 'javascript',
  json: 'json',
  jsonc: 'json',
  jsx: 'jsx',
  kt: 'kotlin',
  md: 'markdown',
  mjs: 'javascript',
  mts: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'shell',
  swift: 'swift',
  toml: 'toml',
  ts: 'typescript',
  tsx: 'tsx',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'shell',
}

export function languageForPath(path: string): string | undefined {
  const cut = path.lastIndexOf('.')
  return cut === -1 ? undefined : LANGUAGES[path.slice(cut + 1).toLowerCase()]
}

/**
 * A tokenizer over a shiki-shaped highlighter. Each row is tokenized on its own: a diff line is
 * not valid source on its own, so any state a multi-line pass would carry would be wrong anyway.
 */
export function shikiRowTokenizer(highlighter: ShikiHighlighter, theme: string): RowTokenizer {
  const loaded = new Set(highlighter.getLoadedLanguages())

  return {
    tokenize: (line: TokenizableLine): RowCanvasToken[] => {
      const language = languageForPath(line.path)
      if (language === undefined || !loaded.has(language) || line.text === '') return []

      const rows = highlighter.codeToTokensBase(line.text, { lang: language, theme })
      return (rows[0] ?? []).map((token): RowCanvasToken => {
        const style = token.fontStyle ?? 0
        return {
          bold: (style & BOLD) !== 0,
          color: token.color,
          italic: (style & ITALIC) !== 0,
          text: token.content,
        }
      })
    },
  }
}

/**
 * Tokens for one window of rows. Rows the tokenizer declines are still reported as covered so
 * the driver never asks about them again — an unhighlightable line must not loop.
 */
export function buildTokensPatch(
  rowIds: readonly string[],
  lines: ReadonlyMap<string, TokenizableLine>,
  tokenizer: RowTokenizer,
  resetKey: string,
): { patch: RowCanvasTokensPatch; covered: string[] } {
  const tokensByRowId: Record<string, RowCanvasToken[]> = {}
  const covered: string[] = []

  for (const rowId of rowIds) {
    const line = lines.get(rowId)
    covered.push(rowId)
    if (line === undefined) continue
    const tokens = tokenizer.tokenize(line)
    if (tokens.length > 0) tokensByRowId[rowId] = tokens
  }

  return { covered, patch: { resetKey, tokensByRowId } }
}
