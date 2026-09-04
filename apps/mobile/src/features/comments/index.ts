import { useMemo, useState } from 'react'
import { commentIndex } from './comment-index'
import {
  anchorRange,
  type CommentAnchor,
  describeRange,
  isLineInRange,
  type LineRange,
  type LineSelection,
  MAX_ANCHOR_TEXT,
  rangeForPath,
  rangeOf,
} from './line-range'

export type { CommentAnchor, LineRange, LineSelection }
export { anchorRange, describeRange, isLineInRange, MAX_ANCHOR_TEXT, rangeForPath, rangeOf }

export { CommentComposer } from './comment-composer'
export { CommentComposerSheet } from './comment-composer-sheet'
export { type ReviewCommentActions, reviewCommentsKey, useCommentActions } from './comment-data'
export {
  type CommentCounts,
  type CommentThread,
  commentAnchorKey,
  commentCounts,
  commentRange,
  commentThreads,
  describeAnchor,
  describeCommentCounts,
} from './comment-threads'
export { ReviewCommentsScreen } from './review-comments-screen'
export { SelectionBar } from './selection-bar'

export type LineSelectionControls = {
  selection: LineSelection | null
  start: (path: string, line: number, side?: 'old' | 'new') => void
  extend: (path: string, line: number, side?: 'old' | 'new') => void
  clear: () => void
}

export function useLineSelection(): LineSelectionControls {
  const [selection, setSelection] = useState<LineSelection | null>(null)
  return useMemo(
    () => ({
      selection,
      start: (path, line, side) =>
        setSelection({ path, anchor: line, focus: line, ...(side === undefined ? {} : { side }) }),
      extend: (path, line, side) =>
        setSelection((current) =>
          current?.path === path &&
          !(current.side !== undefined && side !== undefined && current.side !== side)
            ? {
                path,
                anchor: current.anchor,
                focus: line,
                ...(current.side === side && side !== undefined ? { side } : {}),
              }
            : { path, anchor: line, focus: line, ...(side === undefined ? {} : { side }) },
        ),
      clear: () => setSelection(null),
    }),
    [selection],
  )
}

export { useReviewComments } from './comment-data'

/**
 * Still a placeholder: filing a comment works (`CommentComposer`, `SelectionBar`), but no mobile
 * file or diff row draws a decoration for one that already exists there. Kept so the Files and
 * Changes viewers that already ask for an index compile unchanged, and answering "nothing here"
 * is the truth for those surfaces until one of them grows a gutter marker.
 */
export function useCommentIndex(
  comments: readonly import('@porcelain/contracts/review').ReviewComment[],
  path: string,
  scope?: Extract<
    import('@porcelain/contracts/review').ReviewCommentAnchor,
    { kind: 'file' }
  >['scope'],
): {
  byLine: Map<number, import('@porcelain/contracts/review').ReviewComment[]>
  fileLevel: readonly import('@porcelain/contracts/review').ReviewComment[]
} {
  return useMemo(() => commentIndex(comments, path, scope), [comments, path, scope])
}

export function useCommentedLinesByPath(_comments: readonly unknown[]): Map<string, Set<number>> {
  return new Map()
}
