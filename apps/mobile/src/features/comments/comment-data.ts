/**
 * Mobile Review comments feature public data surface (RVC-004).
 *
 * Re-exports query keys and hooks. Daemon transport lives in the `use-comment-*`
 * modules (Biome's mobile client-import exemption), matching the Board feature-boundary idiom.
 */

export { reviewCommentsQueryKey } from './comment-query-key'
export type { NewComment } from './use-comment-actions'
export { useCommentActions } from './use-comment-actions'
export {
  useCommentedLinesByPath,
  useCommentIndex,
  useReviewComments,
} from './use-comment-reads'
