import type { ReviewComment, ReviewCommentAnchor } from '@porcelain/contracts/review'

type FileAnchor = Extract<ReviewCommentAnchor, { kind: 'file' }>

export function commentIndex(
  comments: readonly ReviewComment[],
  path: string,
  scope?: FileAnchor['scope'],
): { byLine: Map<number, ReviewComment[]>; fileLevel: readonly ReviewComment[] } {
  const byLine = new Map<number, ReviewComment[]>()
  const fileLevel: ReviewComment[] = []
  for (const comment of comments) {
    const commentPath = comment.anchor?.kind === 'file' ? comment.anchor.path : comment.path
    const anchor = comment.anchor?.kind === 'file' ? comment.anchor : undefined
    if (commentPath !== path || !sameScope(anchor?.scope, scope)) continue
    const startLine = comment.anchor?.kind === 'file' ? comment.anchor.startLine : comment.startLine
    const endLine = comment.anchor?.kind === 'file' ? comment.anchor.endLine : comment.endLine
    if (startLine === undefined) {
      fileLevel.push(comment)
      continue
    }
    for (let line = startLine; line <= (endLine ?? startLine); line++) {
      const atLine = byLine.get(line) ?? []
      atLine.push(comment)
      byLine.set(line, atLine)
    }
  }
  return { byLine, fileLevel }
}

function sameScope(left: FileAnchor['scope'], right: FileAnchor['scope']): boolean {
  if (left === undefined) return true
  if (right === undefined || left.type !== right.type) return false
  return (
    left.type === 'working' ||
    (left.type === 'branch' && right.type === 'branch' && left.base === right.base) ||
    (left.type === 'commit' && right.type === 'commit' && left.hash === right.hash)
  )
}
