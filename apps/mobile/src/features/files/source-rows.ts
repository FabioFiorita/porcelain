import { isLineInRange, type LineRange, MAX_ANCHOR_TEXT } from '../comments/line-range'

/** One rendered line of a file: its 1-based number and its text. */
export type SourceRow = {
  key: string
  /** 1-based, matching what an editor, a stack trace, and a review comment all mean by "line". */
  line: number
  text: string
}

/**
 * Split a file into the rows the viewer renders.
 *
 * A trailing newline is a terminator, not an empty last line — POSIX files end with one, and
 * showing the phantom line would put a line number on something no editor counts. An empty
 * file has no rows at all.
 *
 * Keys are the line number: unlike a diff, a file has each line exactly once.
 */
export function toSourceRows(content: string): SourceRow[] {
  if (content === '') return []
  const body = content.endsWith('\n') ? content.slice(0, -1) : content
  return body.split('\n').map((text, index) => ({ key: String(index + 1), line: index + 1, text }))
}

/**
 * The source the selected lines quote, for a comment's anchor text.
 *
 * The whole-file twin of the diff's `anchorTextFor`: same cap, same promise that what the
 * reader saw highlighted is what the agent is quoted.
 */
export function sourceAnchorText(rows: readonly SourceRow[], range: LineRange): string {
  const lines: string[] = []
  for (const row of rows) {
    if (isLineInRange(range, row.line)) lines.push(row.text)
  }
  return lines.join('\n').slice(0, MAX_ANCHOR_TEXT)
}

/** "1.4 KB" / "2.3 MB" — what the binary and too-large states report instead of contents. */
export function describeBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
