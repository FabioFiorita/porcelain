import type { TokenizableLine } from '@/features/changes/lib/canvas-rows'
import type { RowCanvasRow } from '@/lib/row-canvas/types'

/** Stable row id for source line `index` (0-based). Line numbers in the gutter are 1-based. */
export function sourceLineId(index: number): string {
  return `L${index + 1}`
}

export function sourceLineIndex(rowId: string): number | undefined {
  if (!rowId.startsWith('L')) return undefined
  const value = Number(rowId.slice(1))
  return Number.isInteger(value) && value >= 1 ? value - 1 : undefined
}

/**
 * One row per line of source, with a line-number gutter. Tabs stay as tabs: the native
 * monospaced grid draws them; expanding here would desync character columns from the file.
 */
export function buildSourceRows(content: string): RowCanvasRow[] {
  const lines = content.split('\n')
  return lines.map((line, index) => ({
    gutter: String(index + 1),
    id: sourceLineId(index),
    role: 'line',
    text: line,
  }))
}

/** Every source row is tokenizable; the path supplies the language for the whole document. */
export function sourceTokenizableLines(
  path: string,
  content: string,
): Map<string, TokenizableLine> {
  const lines = content.split('\n')
  const map = new Map<string, TokenizableLine>()
  for (const [index, text] of lines.entries()) {
    map.set(sourceLineId(index), { path, text })
  }
  return map
}
