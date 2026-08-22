import { useMemo, useState } from 'react'
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
  start: (path: string, line: number) => void
  extend: (path: string, line: number) => void
  clear: () => void
}

export function useLineSelection(): LineSelectionControls {
  const [selection, setSelection] = useState<LineSelection | null>(null)
  return useMemo(
    () => ({
      selection,
      start: (path, line) => setSelection({ path, anchor: line, focus: line }),
      extend: (path, line) =>
        setSelection((current) =>
          current?.path === path
            ? { ...current, focus: line }
            : { path, anchor: line, focus: line },
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
  _comments: readonly unknown[],
  _path: string,
): { byLine: Map<number, never[]>; fileLevel: readonly never[] } {
  return { byLine: new Map(), fileLevel: [] }
}

export function useCommentedLinesByPath(_comments: readonly unknown[]): Map<string, Set<number>> {
  return new Map()
}
