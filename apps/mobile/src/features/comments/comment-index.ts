import type { ReviewComment } from '@/lib/daemon/procedures/review'

/** A file's comments split into per-line and whole-file lookups, for the diff's markers. */
export type CommentIndex = {
  /** Comments covering each 1-based new-side line; a range is expanded to every line it spans. */
  byLine: Map<number, ReviewComment[]>
  /** Comments anchored to the file as a whole (no line range). */
  fileLevel: ReviewComment[]
}

/**
 * Build the per-line / whole-file lookup for one file.
 *
 * A range comment is expanded into every line it covers, which makes the per-row marker lookup
 * O(1) while scrolling. Kept free of React and the daemon seam so the derivation is testable
 * without a native runtime.
 */
export function buildCommentIndex(comments: readonly ReviewComment[], path: string): CommentIndex {
  const byLine = new Map<number, ReviewComment[]>()
  const fileLevel: ReviewComment[] = []
  for (const comment of comments) {
    if (comment.path !== path) continue
    if (comment.startLine === undefined) {
      fileLevel.push(comment)
      continue
    }
    const end = comment.endLine ?? comment.startLine
    for (let line = comment.startLine; line <= end; line++) {
      const existing = byLine.get(line)
      if (existing) existing.push(comment)
      else byLine.set(line, [comment])
    }
  }
  return { byLine, fileLevel }
}

/** New-side lines carrying a comment, per file — what the read-all surface marks rows with. */
export function commentedLinesByPath(comments: readonly ReviewComment[]): Map<string, Set<number>> {
  const byPath = new Map<string, Set<number>>()
  for (const comment of comments) {
    if (comment.startLine === undefined) continue
    const lines = byPath.get(comment.path) ?? new Set<number>()
    const end = comment.endLine ?? comment.startLine
    for (let line = comment.startLine; line <= end; line++) lines.add(line)
    byPath.set(comment.path, lines)
  }
  return byPath
}
