/**
 * Intra-line highlighting, computed in JS so the canvas stays feature-blind: it paints the
 * character ranges it is handed and never learns what a word is.
 */
type WordRange = { start: number; end: number }

export type WordDiff = { del: WordRange[]; add: WordRange[] }

const EMPTY: WordDiff = { add: [], del: [] }

/** Quadratic in tokens — past this a rewritten line is highlighted as a whole line instead. */
const MAX_TOKENS = 160
/** Beyond four fragments, or nearly half the line, the highlight stops pointing at the edit
 *  and becomes noise. Both guards are on the pair: half a highlighted pair reads as a bug. */
const MAX_RANGES = 4
const MAX_COVERAGE = 0.45

const TOKEN = /[A-Za-z0-9_$]+|\s+|[^\s]/g

type Token = { text: string; start: number }

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  for (const match of text.matchAll(TOKEN)) {
    tokens.push({ start: match.index ?? 0, text: match[0] })
    if (tokens.length > MAX_TOKENS) return tokens
  }
  return tokens
}

/** Longest common subsequence lengths, row-major over `(before.length + 1) * (after.length + 1)`. */
function lcsTable(before: Token[], after: Token[]): Int32Array {
  const width = after.length + 1
  const table = new Int32Array((before.length + 1) * width)
  // The `?? 0` and the `continue` guards are type-level only: every index below is inside the
  // (before.length + 1) * width table by construction. This file sat outside every tsconfig, so
  // `noUncheckedIndexedAccess` never saw it.
  for (let row = before.length - 1; row >= 0; row -= 1) {
    const beforeToken = before[row]
    if (beforeToken === undefined) continue
    for (let column = after.length - 1; column >= 0; column -= 1) {
      const afterToken = after[column]
      if (afterToken === undefined) continue
      table[row * width + column] =
        beforeToken.text === afterToken.text
          ? (table[(row + 1) * width + column + 1] ?? 0) + 1
          : Math.max(table[(row + 1) * width + column] ?? 0, table[row * width + column + 1] ?? 0)
    }
  }
  return table
}

function toRanges(tokens: Token[], changed: boolean[]): WordRange[] {
  const ranges: WordRange[] = []
  for (const [index, token] of tokens.entries()) {
    // Highlighting a changed run of spaces marks re-indentation as an edit; only words carry one.
    if (!changed[index] || token.text.trim() === '') continue
    const start = token.start
    const end = start + token.text.length
    const previous = ranges.at(-1)
    if (previous !== undefined && previous.end === start) {
      previous.end = end
      continue
    }
    ranges.push({ end, start })
  }
  return ranges
}

function coverage(ranges: WordRange[], length: number): number {
  if (length === 0) return 1
  return ranges.reduce((total, range) => total + (range.end - range.start), 0) / length
}

function isNoise(ranges: WordRange[], text: string): boolean {
  return ranges.length > MAX_RANGES || coverage(ranges, text.length) > MAX_COVERAGE
}

/**
 * Word ranges that differ between a deleted line and the added line replacing it. Returns no
 * ranges at all when the pair is unhighlightable — an empty result is the honest answer, and
 * the caller renders the plain tone it already had.
 */
export function wordDiff(before: string, after: string): WordDiff {
  if (before === '' || after === '' || before === after) return EMPTY

  const beforeTokens = tokenize(before)
  const afterTokens = tokenize(after)
  if (beforeTokens.length > MAX_TOKENS || afterTokens.length > MAX_TOKENS) return EMPTY

  const width = afterTokens.length + 1
  const table = lcsTable(beforeTokens, afterTokens)
  const beforeChanged = new Array<boolean>(beforeTokens.length).fill(true)
  const afterChanged = new Array<boolean>(afterTokens.length).fill(true)

  let row = 0
  let column = 0
  while (row < beforeTokens.length && column < afterTokens.length) {
    const beforeToken = beforeTokens[row]
    const afterToken = afterTokens[column]
    if (beforeToken === undefined || afterToken === undefined) break
    if (beforeToken.text === afterToken.text) {
      beforeChanged[row] = false
      afterChanged[column] = false
      row += 1
      column += 1
    } else if ((table[(row + 1) * width + column] ?? 0) >= (table[row * width + column + 1] ?? 0)) {
      row += 1
    } else {
      column += 1
    }
  }

  const del = toRanges(beforeTokens, beforeChanged)
  const add = toRanges(afterTokens, afterChanged)
  if (isNoise(del, before) || isNoise(add, after)) return EMPTY
  return { add, del }
}
