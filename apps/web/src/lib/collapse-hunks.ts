import type { DiffHunk, DiffLine } from '@porcelain/contracts/git'

/**
 * Context collapsing for the single-file diff page.
 *
 * The daemon can hand back a diff with as much unchanged context as we ask for
 * (`gitDiffFile({ context })`). The page asks for the whole file once and then
 * hides everything more than `context` lines from a change, so expanding a gap
 * is local state rather than another round trip. The stacked "All changes"
 * reader keeps git's own 3-line hunks and never goes through here.
 */

/** Inclusive range of new-side line numbers the reader has expanded. */
export interface LineRange {
  from: number
  to: number
}

/** A run of hidden unchanged lines standing between two visible stretches. */
export interface DiffGap {
  /**
   * Index of the collapsed hunk this gap sits above. Equals the hunk count for a
   * gap that trails the last hunk (the tail of the file).
   */
  beforeHunk: number
  /** First and last hidden new-side line numbers (inclusive). */
  startNew: number
  endNew: number
  count: number
  /**
   * False when the hidden lines were never fetched — the boundary between two
   * hunks of a narrow-context diff. Such a gap is a marker only; there is
   * nothing local to reveal.
   */
  expandable: boolean
}

export interface CollapsedDiff {
  hunks: DiffHunk[]
  gaps: DiffGap[]
}

/** Unchanged lines kept either side of a change — git's own default. */
export const DEFAULT_DIFF_CONTEXT = 3

/** Lines one expand-up / expand-down click reveals. */
export const EXPAND_STEP = 20

/** Context wide enough that the daemon returns the whole file in one hunk. */
export const FULL_DIFF_CONTEXT = 100_000

const ALL_LINES: LineRange = { from: 1, to: Number.MAX_SAFE_INTEGER }

/** The reveal set for "expand all" — every line of every gap. */
export function allRevealed(): LineRange[] {
  return [ALL_LINES]
}

function isRevealed(line: DiffLine, revealed: readonly LineRange[]): boolean {
  const n = line.newLine
  if (n === null) return true
  return revealed.some((range) => n >= range.from && n <= range.to)
}

/** Add a range to a reveal set, merging it into any range it touches. */
export function addRange(ranges: readonly LineRange[], next: LineRange): LineRange[] {
  const merged = [...ranges, next].sort((a, b) => a.from - b.from)
  const out: LineRange[] = []
  for (const range of merged) {
    const last = out.at(-1)
    if (last && range.from <= last.to + 1) last.to = Math.max(last.to, range.to)
    else out.push({ ...range })
  }
  return out
}

/** Reveal the bottom of a gap — the code below it grows upward. */
export function revealUp(gap: DiffGap, step = EXPAND_STEP): LineRange {
  return { from: Math.max(gap.startNew, gap.endNew - step + 1), to: gap.endNew }
}

/** Reveal the top of a gap — the code above it grows downward. */
export function revealDown(gap: DiffGap, step = EXPAND_STEP): LineRange {
  return { from: gap.startNew, to: Math.min(gap.endNew, gap.startNew + step - 1) }
}

/** Reveal a whole gap at once. */
export function revealWhole(gap: DiffGap): LineRange {
  return { from: gap.startNew, to: gap.endNew }
}

/** Which lines of a hunk stay visible: changes, their context, and reveals. */
function visibleMask(
  lines: readonly DiffLine[],
  context: number,
  revealed: readonly LineRange[],
): boolean[] {
  const mask = lines.map((line) => line.kind !== 'context' || isRevealed(line, revealed))
  const changed = lines.flatMap((line, index) => (line.kind === 'context' ? [] : [index]))
  for (const index of changed) {
    for (
      let i = Math.max(0, index - context);
      i <= Math.min(lines.length - 1, index + context);
      i++
    ) {
      mask[i] = true
    }
  }
  return mask
}

function gapAt(
  lines: readonly DiffLine[],
  start: number,
  end: number,
  beforeHunk: number,
): DiffGap {
  const startNew = lines[start]?.newLine ?? 0
  const endNew = lines[end]?.newLine ?? 0
  return { beforeHunk, count: end - start + 1, endNew, expandable: true, startNew }
}

/**
 * Split hunks into the stretches that stay on screen plus the gaps between them.
 *
 * Output hunks carry an empty header: the gap rows say where you are, and a
 * `@@ -1,900 +1,905 @@` header from a whole-file diff would only mislead.
 */
export function collapseHunks(
  hunks: readonly DiffHunk[],
  options: { context?: number; revealed?: readonly LineRange[] } = {},
): CollapsedDiff {
  const context = options.context ?? DEFAULT_DIFF_CONTEXT
  const revealed = options.revealed ?? []
  const out: DiffHunk[] = []
  const gaps: DiffGap[] = []
  let previousEndNew: number | null = null

  for (const hunk of hunks) {
    if (hunk.lines.length === 0) continue
    // A boundary between narrow-context hunks: lines we never fetched. Mark it so
    // the reader still sees that the file jumps, but offer nothing to expand.
    const firstNew = hunk.lines.find((line) => line.newLine !== null)?.newLine ?? null
    if (previousEndNew !== null && firstNew !== null && firstNew > previousEndNew + 1) {
      gaps.push({
        beforeHunk: out.length,
        count: firstNew - previousEndNew - 1,
        endNew: firstNew - 1,
        expandable: false,
        startNew: previousEndNew + 1,
      })
    }

    const mask = visibleMask(hunk.lines, context, revealed)
    let run: DiffLine[] = []
    let hiddenStart: number | null = null
    const flushHidden = (end: number): void => {
      if (hiddenStart === null) return
      gaps.push(gapAt(hunk.lines, hiddenStart, end, out.length))
      hiddenStart = null
    }
    const flushRun = (): void => {
      if (run.length === 0) return
      out.push({ header: '', lines: run })
      run = []
    }

    hunk.lines.forEach((line, index) => {
      if (mask[index]) {
        flushHidden(index - 1)
        run.push(line)
      } else {
        flushRun()
        if (hiddenStart === null) hiddenStart = index
      }
    })
    flushRun()
    flushHidden(hunk.lines.length - 1)
    previousEndNew = hunk.lines.reduce<number | null>(
      (acc, line) => (line.newLine === null ? acc : line.newLine),
      previousEndNew,
    )
  }

  return { gaps, hunks: out }
}
