import { type ReviewQuery, reviewQuerySchema } from '@porcelain/client-runtime/review'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { daemonScopeSchema } from '@renderer/lib/daemon-scope'
import { z } from 'zod'

/**
 * Web's exact Review key: semantic identity first, daemon scope second (REV-007).
 *
 * Parsed rather than pattern-matched, exactly like `features/git/git-query-key.ts` and
 * `comments/comment-query-key.ts`. The comments identity is a member of
 * `reviewQuerySchema`, so a comments key parses here too; comment invalidation still flows
 * through `comments/comment-query-key.ts` — this namespace adds no second owner for them.
 */
const reviewQueryKeySchema = z.tuple([reviewQuerySchema, daemonScopeSchema])

export type ReviewQueryKey = readonly [ReviewQuery, DaemonScope]

export function reviewQueryKey(daemon: DaemonScope, query: ReviewQuery): ReviewQueryKey {
  return [query, { host: daemon.host, version: daemon.version }] as const
}

export function parseReviewQueryKey(
  queryKey: readonly unknown[],
): { query: ReviewQuery; daemon: DaemonScope } | null {
  const parsed = reviewQueryKeySchema.safeParse(queryKey)
  return parsed.success ? { daemon: parsed.data[1], query: parsed.data[0] } : null
}

export function isReviewQueryKey(queryKey: readonly unknown[]): boolean {
  return reviewQueryKeySchema.safeParse(queryKey).success
}
