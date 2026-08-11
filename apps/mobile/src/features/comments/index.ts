/** Mobile Review comments public feature boundary (RVC-004). */

export type { CommentAnchor } from './comment-composer'
export { CommentComposer } from './comment-composer'
export type { CommentIndex } from './comment-index'
export { buildCommentIndex, commentedLinesByPath } from './comment-index'
export { ReviewCommentNotificationBridge } from './comment-notification-bridge'
export { invalidateAllReviewComments } from './comment-notifications'
export type { LineRange, LineSelection } from './line-range'
export {
  describeRange,
  isLineInRange,
  MAX_ANCHOR_TEXT,
  rangeForPath,
  rangeOf,
} from './line-range'
export { SelectionBar } from './selection-bar'
export type { NewComment } from './use-comment-actions'
export { useCommentActions } from './use-comment-actions'
export {
  useCommentedLinesByPath,
  useCommentIndex,
  useReviewComments,
} from './use-comment-reads'
export type { LineSelectionControls } from './use-line-selection'
export { useLineSelection } from './use-line-selection'
