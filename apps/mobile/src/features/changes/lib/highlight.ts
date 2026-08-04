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
  bash: 'shellscript',
  cjs: 'javascript',
  css: 'css',
  env: 'dotenv',
  go: 'go',
  htm: 'html',
  html: 'html',
  js: 'javascript',
  json: 'json',
  jsonc: 'json',
  jsx: 'jsx',
  kt: 'kotlin',
  markdown: 'markdown',
  md: 'markdown',
  mdx: 'markdown',
  mjs: 'javascript',
  mts: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'shellscript',
  swift: 'swift',
  toml: 'toml',
  ts: 'typescript',
  tsx: 'tsx',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'shellscript',
}

/**
 * Files larger than this are not syntax-highlighted. Whole-file tokenization keeps multiline
 * grammar state correct; above the cap the canvas stays plain text rather than janking a frame.
 */
export const MAX_SOURCE_TOKENIZE_LINES = 10_000
const MAX_SOURCE_TOKENIZE_BYTES = 2 * 1024 * 1024

export function languageForPath(path: string): string | undefined {
  const base = path.split(/[/\\]/).at(-1)?.toLowerCase() ?? ''
  if (base === '.env' || base.startsWith('.env.')) return 'dotenv'
  const cut = base.lastIndexOf('.')
  return cut === -1 ? undefined : LANGUAGES[base.slice(cut + 1)]
}

/** True when the clipped source body is small enough to tokenise as one document. */
export function isSourceTokenizable(content: string): boolean {
  if (content.length > MAX_SOURCE_TOKENIZE_BYTES) return false
  let newlines = 0
  let index = content.indexOf('\n')
  while (index !== -1) {
    newlines += 1
    if (newlines > MAX_SOURCE_TOKENIZE_LINES) return false
    index = content.indexOf('\n', index + 1)
  }
  return true
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

function tokensFromShiki(row: ShikiToken[]): RowCanvasToken[] {
  return row.map((token): RowCanvasToken => {
    const style = token.fontStyle ?? 0
    return {
      bold: (style & BOLD) !== 0,
      color: token.color,
      italic: (style & ITALIC) !== 0,
      text: token.content,
    }
  })
}

/**
 * Whole-file source tokens, one entry per source line id (`L1`, `L2`, …). Multiline grammar
 * state (open block comments, template literals) survives because Shiki sees the full document.
 * Returns null when the language is unknown, unloaded, or the body is too large to tokenise.
 */
export function tokenizeSourceDocument(
  highlighter: ShikiHighlighter,
  content: string,
  path: string,
  theme: string,
): ReadonlyMap<string, RowCanvasToken[]> | null {
  const language = languageForPath(path)
  if (language === undefined || !isSourceTokenizable(content)) return null
  if (!highlighter.getLoadedLanguages().includes(language)) return null

  const rows = highlighter.codeToTokensBase(content, { lang: language, theme })
  const byRowId = new Map<string, RowCanvasToken[]>()
  for (const [index, row] of rows.entries()) {
    if (row.length === 0) continue
    byRowId.set(`L${index + 1}`, tokensFromShiki(row))
  }
  return byRowId
}

/**
 * Pull a window of precomputed source tokens into a canvas patch. Covered rows that had no
 * tokens still mark as done so the driver never re-asks.
 */
export function buildSourceTokensPatch(
  rowIds: readonly string[],
  tokensByLine: ReadonlyMap<string, RowCanvasToken[]>,
  resetKey: string,
): { patch: RowCanvasTokensPatch; covered: string[] } {
  const tokensByRowId: Record<string, RowCanvasToken[]> = {}
  const covered: string[] = []

  for (const rowId of rowIds) {
    covered.push(rowId)
    const tokens = tokensByLine.get(rowId)
    if (tokens !== undefined && tokens.length > 0) tokensByRowId[rowId] = tokens
  }

  return { covered, patch: { resetKey, tokensByRowId } }
}
