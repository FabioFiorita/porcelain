/**
 * Mobile Review comments feature public data surface (RVC-004).
 *
 * Re-exports data hooks only. Query keys stay internal (`comment-query-key.ts`); tests may
 * import them directly. Daemon transport lives in the `use-comment-*` modules (Biome's mobile
 * client-import exemption), matching the Board feature-boundary idiom.
 */

export type { NewComment } from './use-comment-actions'
export { useCommentActions } from './use-comment-actions'
export {
  useCommentedLinesByPath,
  useCommentIndex,
  useReviewComments,
} from './use-comment-reads'
