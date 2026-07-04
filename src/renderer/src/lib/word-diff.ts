import type { DiffHunk, DiffLine } from '@backend/diff'

/** A half-open character range `[start, end)` within a single line's text. */
export interface CharRange {
  start: number
  end: number
}

/**
 * Character-level change range between two versions of a line, GitHub Desktop
 * style: trim the shared prefix and suffix and emphasize only the differing
 * middle. Returns `null` for a side whose middle is empty — a pure insertion
 * leaves the deleted side unchanged, and a pure deletion the added side.
 */
export function lineChangeRange(
  oldText: string,
  newText: string,
): { old: CharRange | null; new: CharRange | null } {
  if (oldText === newText) return { old: null, new: null }
  const min = Math.min(oldText.length, newText.length)
  let prefix = 0
  while (prefix < min && oldText[prefix] === newText[prefix]) prefix++
  let suffix = 0
  while (
    suffix < min - prefix &&
    oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]
  ) {
    suffix++
  }
  const oldEnd = oldText.length - suffix
  const newEnd = newText.length - suffix
  return {
    old: prefix < oldEnd ? { start: prefix, end: oldEnd } : null,
    new: prefix < newEnd ? { start: prefix, end: newEnd } : null,
  }
}

/**
 * Do two lines share an anchor — a common first or last character? Equivalent to
 * "have a non-empty common prefix or suffix". This is the gate for intra-line
 * emphasis: a sub-range highlight only reads as meaningful when part of the line
 * is held fixed. Lines that share nothing (a blank line, totally disjoint content)
 * are left to the plain changed-line background instead of a misleading whole-line mark.
 */
function sharesAnchor(a: string, b: string): boolean {
  return a.length > 0 && b.length > 0 && (a[0] === b[0] || a[a.length - 1] === b[b.length - 1])
}

/**
 * Pair the deleted and added lines inside each hunk — zipping consecutive del/add
 * runs by position, like GitHub Desktop — and compute the intra-line change range
 * for each pair that shares an anchor (see `sharesAnchor`). The result is keyed by
 * `DiffLine` identity so renderers look up a line's emphasis ranges the same way they
 * look up its syntax tokens. Lines with no counterpart (a pure addition/deletion, the
 * overflow of an uneven run, or a pairing that shares nothing) are absent.
 */
export function intraLineEmphasis(hunks: readonly DiffHunk[]): Map<DiffLine, CharRange[]> {
  const map = new Map<DiffLine, CharRange[]>()
  for (const { lines } of hunks) {
    let i = 0
    while (i < lines.length) {
      if (lines[i]?.kind !== 'del') {
        i++
        continue
      }
      const dels: DiffLine[] = []
      while (lines[i]?.kind === 'del') {
        const line = lines[i]
        if (line) dels.push(line)
        i++
      }
      const adds: DiffLine[] = []
      while (lines[i]?.kind === 'add') {
        const line = lines[i]
        if (line) adds.push(line)
        i++
      }
      const pairs = Math.min(dels.length, adds.length)
      for (let p = 0; p < pairs; p++) {
        const del = dels[p]
        const add = adds[p]
        if (!del || !add || !sharesAnchor(del.text, add.text)) continue
        const { old, new: next } = lineChangeRange(del.text, add.text)
        if (old) map.set(del, [old])
        if (next) map.set(add, [next])
      }
    }
  }
  return map
}

/** A piece of a rendered line: shared `color` from syntax tokens, plus whether it sits in a changed range. */
export interface Span {
  content: string
  color?: string
  emphasized: boolean
}

/**
 * Split base spans (syntax tokens, or a single plain-text span) at the boundaries
 * of `ranges`, flagging the pieces that fall inside a changed range. Walks a running
 * character offset so it doesn't depend on token offset metadata.
 */
export function splitByRanges(
  spans: readonly { content: string; color?: string }[],
  ranges: readonly CharRange[],
): Span[] {
  const inRange = (idx: number): boolean => ranges.some((r) => idx >= r.start && idx < r.end)
  const out: Span[] = []
  let pos = 0
  for (const { content, color } of spans) {
    let i = 0
    while (i < content.length) {
      const emph = inRange(pos + i)
      let j = i + 1
      while (j < content.length && inRange(pos + j) === emph) j++
      out.push({ content: content.slice(i, j), color, emphasized: emph })
      i = j
    }
    pos += content.length
  }
  return out
}
