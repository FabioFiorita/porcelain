import type { ReviewComment } from '@porcelain/contracts/review'
import { CommentMarker } from '@renderer/components/git/comment-marker'
import { useCommentIndex } from '@renderer/features/review'
import { TestIds } from '@shared/test-ids'
import { useMemo } from 'react'

function commentsForFile(index: {
  byLine: Map<number, ReviewComment[]>
  fileLevel: ReviewComment[]
}): ReviewComment[] {
  const comments = new Map<string, ReviewComment>()
  for (const comment of index.fileLevel) comments.set(comment.id, comment)
  for (const lineComments of index.byLine.values()) {
    for (const comment of lineComments) comments.set(comment.id, comment)
  }
  return [...comments.values()]
}

/**
 * File-level comment affordance for sidebar rows. Existing comments reuse the same
 * speech-bubble popover as inline diff markers. A comment is created only from the
 * row's context menu, so files without comments do not grow an empty action button.
 */
export function FileCommentButton({ path }: { path: string }): React.JSX.Element | null {
  const index = useCommentIndex(path)
  const comments = useMemo(() => commentsForFile(index), [index])

  if (comments.length === 0) return null

  return (
    <div
      data-testid={TestIds.fileComments(path)}
      className="absolute right-1 top-1/2 z-10 -translate-y-1/2"
    >
      <CommentMarker comments={comments} />
    </div>
  )
}
