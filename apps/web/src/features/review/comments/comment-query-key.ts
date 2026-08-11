import { type ReviewCommentsQuery, reviewCommentsQuery } from '@porcelain/client-runtime/review'

/**
 * Web React Query key for Review comments: RVC-002 identity + active daemon scope.
 * The only comments server-state key; procedure-name strings never appear here.
 */

export type ReviewCommentsDaemonScope = {
  readonly host: string | null
  readonly version: string | null
}

/** Compose the exact React Query key for one Project's comments on one daemon. */
export function reviewCommentsQueryKey(
  daemon: ReviewCommentsDaemonScope,
  commentsQuery: ReviewCommentsQuery,
): readonly [ReviewCommentsQuery, ReviewCommentsDaemonScope] {
  return [commentsQuery, { host: daemon.host, version: daemon.version }] as const
}

/** Build the comments key for a Project path under the active daemon scope. */
export function reviewCommentsKeyForProject(
  daemon: ReviewCommentsDaemonScope,
  projectPath: string,
): readonly [ReviewCommentsQuery, ReviewCommentsDaemonScope] {
  return reviewCommentsQueryKey(daemon, reviewCommentsQuery(projectPath))
}

/** True when a React Query key is a Review comments identity (any Project / daemon). */
export function isReviewCommentsQueryKey(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0]
  return (
    typeof head === 'object' &&
    head !== null &&
    'domain' in head &&
    (head as { domain: unknown }).domain === 'review' &&
    'name' in head &&
    (head as { name: unknown }).name === 'comments'
  )
}
