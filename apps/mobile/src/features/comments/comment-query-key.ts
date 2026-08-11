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

/**
 * True only for the exact mobile three-tuple:
 * `['daemon', stringEnvironmentId, { domain:'review', name:'comments', projectPath:string }]`.
 * Rejects extra elements, missing/non-string projectPath, and Web-shaped head-identity keys.
 */
export function isReviewCommentsQueryKey(queryKey: readonly unknown[]): boolean {
  if (queryKey.length !== 3) return false
  if (queryKey[0] !== 'daemon') return false
  if (typeof queryKey[1] !== 'string') return false
  const identity = queryKey[2]
  if (typeof identity !== 'object' || identity === null || Array.isArray(identity)) return false
  const record = identity as Record<string, unknown>
  return (
    record.domain === 'review' &&
    record.name === 'comments' &&
    typeof record.projectPath === 'string'
  )
}
