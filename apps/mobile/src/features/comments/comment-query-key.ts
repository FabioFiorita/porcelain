import {
  type ReviewCommentsQuery,
  reviewCommentsQuery,
  reviewCommentsQuerySchema,
} from '@porcelain/client-runtime/review'
import { z } from 'zod'

/**
 * Mobile React Query key for Review comments: RVC-002 identity + active environment id.
 * The only comments server-state key; procedure-name strings never appear here.
 */

/**
 * Mobile's key layout is a three-tuple, not Web's `[identity, scope]`: the environment id
 * leads so every daemon-backed key shares one `['daemon', environmentId, …]` prefix. The
 * identity element is the SAME shared RVC-002 schema Web parses — only the tuple differs.
 */
const reviewCommentsQueryKeySchema = z.tuple([
  z.literal('daemon'),
  z.string(),
  reviewCommentsQuerySchema,
])

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
  return reviewCommentsQueryKeySchema.safeParse(queryKey).success
}
