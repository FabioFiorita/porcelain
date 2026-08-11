import { type ReviewCommentsQuery, reviewCommentsQuery } from '@porcelain/client-runtime/review'

/**
 * Mobile React Query key for Review comments: RVC-002 identity + active environment id.
 * The only comments server-state key; procedure-name strings never appear here.
 */

/** Compose the exact React Query key for one Project's comments on one environment. */
export function reviewCommentsQueryKey(
  environmentId: string,
  projectPath: string,
): readonly ['daemon', string, ReviewCommentsQuery] {
  return ['daemon', environmentId, reviewCommentsQuery(projectPath)] as const
}

/** Build the comments key from an RVC-002 identity (notification effects). */
export function reviewCommentsQueryKeyForIdentity(
  environmentId: string,
  identity: ReviewCommentsQuery,
): readonly ['daemon', string, ReviewCommentsQuery] {
  return ['daemon', environmentId, identity] as const
}

/** True when a React Query key is a Review comments identity (any Project / environment). */
export function isReviewCommentsQueryKey(queryKey: readonly unknown[]): boolean {
  if (queryKey[0] !== 'daemon') return false
  if (typeof queryKey[1] !== 'string') return false
  const identity = queryKey[2]
  return (
    typeof identity === 'object' &&
    identity !== null &&
    'domain' in identity &&
    (identity as { domain: unknown }).domain === 'review' &&
    'name' in identity &&
    (identity as { name: unknown }).name === 'comments'
  )
}
