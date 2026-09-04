import type { ReviewComment, ReviewCommentAnchor } from '@porcelain/contracts/review'

/**
 * Pure per-file presentation index for Review comments.
 *
 * Filters by path and expands line ranges into
 * every covered line, and file-level routing when `startLine` is absent.
 */

/** A file's comments split into per-line and file-level lookups, for viewer markers. */
export interface CommentIndex {
  /** Comments covering each 1-based line (a range expands to every line it spans). */
  byLine: Map<number, ReviewComment[]>
  /** Comments anchored to the whole file (no line range). */
  fileLevel: ReviewComment[]
}

/**
 * Build the per-line / file-level comment lookup for one file. Pure and exported so the
 * derivation is unit-testable without a query. A range comment (`startLine..endLine`) is
 * expanded into every line it covers, so a per-row marker lookup is O(1).
 */
type FileAnchor = Extract<ReviewCommentAnchor, { kind: 'file' }>

function sameScope(left: FileAnchor['scope'], right: FileAnchor['scope']): boolean {
  if (left === undefined) return true
  if (right === undefined || left.type !== right.type) return false
  return (
    left.type === 'working' ||
    (left.type === 'branch' && right.type === 'branch' && left.base === right.base) ||
    (left.type === 'commit' && right.type === 'commit' && left.hash === right.hash)
  )
}

export function buildCommentIndex(
  comments: readonly ReviewComment[],
  path: string,
  scope?: FileAnchor['scope'],
): CommentIndex {
  const byLine = new Map<number, ReviewComment[]>()
  const fileLevel: ReviewComment[] = []
  for (const comment of comments) {
    const anchor = comment.anchor
    const file =
      anchor?.kind === 'file' ? anchor : anchor === undefined && comment.path ? comment : null
    if (file === null || file.path !== path || !sameScope(file.scope, scope)) continue
    if (file.startLine === undefined) {
      fileLevel.push(comment)
      continue
    }
    const end = file.endLine ?? file.startLine
    for (let line = file.startLine; line <= end; line++) {
      const list = byLine.get(line)
      if (list) list.push(comment)
      else byLine.set(line, [comment])
    }
  }
  return { byLine, fileLevel }
}
