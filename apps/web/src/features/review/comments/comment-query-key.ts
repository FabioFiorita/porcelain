import {
  type ReviewCommentsQuery,
  reviewCommentsQuery,
  reviewCommentsQuerySchema,
} from '@porcelain/client-runtime/review'
import { type DaemonScope, daemonScopeSchema } from '@renderer/lib/daemon-scope'
import { z } from 'zod'

/**
 * Web React Query key for Review comments: shared Review-comment identity + active daemon scope.
 * The only comments server-state key; procedure-name strings never appear here.
 */

/** The exact two-element key shape, parsed rather than pattern-matched. */
const reviewCommentsQueryKeySchema = z.tuple([reviewCommentsQuerySchema, daemonScopeSchema])

/** Compose the exact React Query key for one Project's comments on one daemon. */
export function reviewCommentsQueryKey(
  daemon: DaemonScope,
  commentsQuery: ReviewCommentsQuery,
): readonly [ReviewCommentsQuery, DaemonScope] {
  return [commentsQuery, { host: daemon.host, version: daemon.version }] as const
}

/** Build the comments key for a Project path under the active daemon scope. */
export function reviewCommentsKeyForProject(
  daemon: DaemonScope,
  projectPath: string,
): readonly [ReviewCommentsQuery, DaemonScope] {
  return reviewCommentsQueryKey(daemon, reviewCommentsQuery(projectPath))
}

/** True when a React Query key is a Review comments identity (any Project / daemon). */
export function isReviewCommentsQueryKey(queryKey: readonly unknown[]): boolean {
  return reviewCommentsQueryKeySchema.safeParse(queryKey).success
}
