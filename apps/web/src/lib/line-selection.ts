export interface LineSelection {
  startLine: number
  endLine: number
  text: string
  side?: 'old' | 'new'
}

/**
 * Resolve a range boundary (a container node + offset) to the 1-based line it sits
 * in, by reading the `data-line` attribute the source/diff rows carry. When the
 * boundary is an element (e.g. a triple-click whose focus lands on a row WRAPPER that
 * has no `data-line`), descend to the child the offset points at before climbing —
 * otherwise `closest` would walk past the rows entirely and find nothing.
 */
/** The nearest `[data-line]` row element a range boundary (container + offset) sits in. */
function elementAt(container: Node, offset: number): Element | null {
  let node: Node | null = container
  if (container.nodeType === Node.ELEMENT_NODE) {
    const element = container as Element
    node = element.childNodes[offset] ?? element.childNodes[offset - 1] ?? element
  }
  return node instanceof Element ? node : (node?.parentElement ?? null)
}

function rowAt(container: Node, offset: number): Element | null {
  return elementAt(container, offset)?.closest('[data-line]') ?? null
}

function lineOf(row: Element | null): number | null {
  const value = row?.getAttribute('data-line')
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function sideOf(row: Element | null): 'old' | 'new' | undefined {
  const side = row?.getAttribute('data-side')
  return side === 'old' || side === 'new' ? side : undefined
}

function sourceRangeOf(element: Element | null): { startLine: number; endLine: number } | null {
  const source = element?.closest('[data-source-start-line]')
  if (!source) return null
  const startLine = Number.parseInt(source.getAttribute('data-source-start-line') ?? '', 10)
  const endLine = Number.parseInt(
    source.getAttribute('data-source-end-line') ?? String(startLine),
    10,
  )
  if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) return null
  return { startLine, endLine }
}

function lineAt(container: Node, offset: number): number | null {
  return lineOf(rowAt(container, offset))
}

/**
 * Map a DOM `Range` to a 1-based line range using the rows' `data-line` attributes.
 * Returns null when neither endpoint lands in a line row. If only one endpoint
 * resolves (the other fell on chrome past the rows), that single line is used for
 * both ends. The pure core of `lineSelectionFromDom`, split out so it's testable
 * with a constructed `Range`.
 */
export function lineRangeFromRange(range: Range): { startLine: number; endLine: number } | null {
  const start = lineAt(range.startContainer, range.startOffset)
  const end = lineAt(range.endContainer, range.endOffset)
  const lines = [start, end].filter((line): line is number => line !== null)
  if (lines.length === 0) {
    const start = sourceRangeOf(elementAt(range.startContainer, range.startOffset))
    const end = sourceRangeOf(elementAt(range.endContainer, range.endOffset))
    const ranges = [start, end].filter(
      (value): value is { startLine: number; endLine: number } => value !== null,
    )
    if (ranges.length === 0) return null
    return {
      startLine: Math.min(...ranges.map((value) => value.startLine)),
      endLine: Math.max(...ranges.map((value) => value.endLine)),
    }
  }
  return { startLine: Math.min(...lines), endLine: Math.max(...lines) }
}

/** Resolve selected rendered text back to its first occurrence in the source. */
export function lineRangeForSelectedText(
  source: string,
  selectedText: string,
): LineSelection | null {
  const text = selectedText.trim()
  if (text === '') return null
  const start = source.indexOf(text)
  if (start < 0) return null
  const range = lineRangeFromOffsets(source, start, start + text.length)
  return range ? { ...range, text } : null
}

/**
 * Map the current DOM text selection to a 1-based line range. Returns null when
 * there's no (non-collapsed) selection or it doesn't land in line rows. Rows are
 * virtualized, but a visible selection's endpoints are mounted by definition.
 */
export function lineSelectionFromDom(): LineSelection | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
  const range = lineRangeFromRange(selection.getRangeAt(0))
  if (!range) return null
  const domRange = selection.getRangeAt(0)
  const startSide = sideOf(rowAt(domRange.startContainer, domRange.startOffset))
  const endSide = sideOf(rowAt(domRange.endContainer, domRange.endOffset))
  if (startSide !== undefined && endSide !== undefined && startSide !== endSide) return null
  return {
    ...range,
    text: selection.toString(),
    ...(startSide === endSide ? { side: startSide } : {}),
  }
}

/**
 * Map a `Range` to a 1-based line range WITHIN a single file, for a surface that
 * interleaves many files in one scroll (the Review reading surface): rows there
 * carry `data-file` alongside `data-line`, and only endpoints in `path` count. A
 * selection that crosses INTO another file can't anchor cleanly to one, so it
 * returns null (the caller falls back to the single right-clicked line). The pure
 * core of `lineSelectionForFile`, split out so it's testable with a built `Range`.
 */
export function fileLineRangeFromRange(
  range: Range,
  path: string,
): { startLine: number; endLine: number } | null {
  const startRow = rowAt(range.startContainer, range.startOffset)
  const endRow = rowAt(range.endContainer, range.endOffset)
  const startFile = startRow?.getAttribute('data-file') ?? null
  const endFile = endRow?.getAttribute('data-file') ?? null
  if (startFile !== null && endFile !== null && startFile !== endFile) return null
  const lines: number[] = []
  for (const [row, file] of [
    [startRow, startFile],
    [endRow, endFile],
  ] as const) {
    if (file !== path) continue
    const line = lineOf(row)
    if (line !== null) lines.push(line)
  }
  if (lines.length === 0) return null
  return { startLine: Math.min(...lines), endLine: Math.max(...lines) }
}

/**
 * Map the current DOM text selection to a 1-based line range within `path` on a
 * multi-file surface. Null when there's no (non-collapsed) selection or it doesn't
 * land in that file's rows. The anchor text is capped — it's best-effort context.
 */
export function lineSelectionForFile(path: string): LineSelection | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
  const domRange = selection.getRangeAt(0)
  const range = fileLineRangeFromRange(domRange, path)
  if (!range) return null
  const startSide = sideOf(rowAt(domRange.startContainer, domRange.startOffset))
  const endSide = sideOf(rowAt(domRange.endContainer, domRange.endOffset))
  if (startSide !== undefined && endSide !== undefined && startSide !== endSide) return null
  return {
    ...range,
    text: selection.toString().slice(0, 2000),
    ...(startSide === endSide ? { side: startSide } : {}),
  }
}

function countNewlines(text: string): number {
  let count = 0
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') count++
  return count
}

/**
 * Map a textarea's character-offset selection (`start`..`end`) to a 1-based line
 * range, for the editable source viewer — a `<textarea>` has no `data-line` rows to
 * walk, so we count newlines in the raw text instead. Returns null for a caret-only /
 * empty selection (`start === end`). A selection that ends exactly on a `'\n'` closes
 * the line it just finished rather than spilling into the next one, so dragging to the
 * end of a line doesn't over-count.
 */
export function lineRangeFromOffsets(
  text: string,
  start: number,
  end: number,
): { startLine: number; endLine: number } | null {
  if (start === end) return null
  const startLine = countNewlines(text.slice(0, start)) + 1
  // A selection ending on a line boundary belongs to the line it closed, not the next.
  const endBoundary = end > start && text[end - 1] === '\n' ? end - 1 : end
  const endLine = countNewlines(text.slice(0, endBoundary)) + 1
  return { startLine, endLine: Math.max(startLine, endLine) }
}
