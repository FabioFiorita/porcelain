import { reviewCommentsQuery } from '@porcelain/client-runtime/review'
import type { ReviewComment } from '@porcelain/contracts/review'
import { reviewProcedures } from '@porcelain/contracts/review'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useActiveProject } from '@/features/projects'
import { getDaemonClient } from '@/lib/daemon/client'
import { isPaired } from '@/lib/daemon/environment'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { callDaemon, namedContractProcedure } from '@/lib/daemon/procedure'

import { buildCommentIndex, type CommentIndex, commentedLinesByPath } from './comment-index'
import { reviewCommentsQueryKey } from './comment-query-key'

/**
 * Review comment read + presentation hooks (RVC-004).
 * Public surface re-exports through `comment-data.ts`.
 */

const reviewCommentsProcedure = namedContractProcedure(
  'reviewComments',
  reviewProcedures.reviewComments,
)

/**
 * Every review comment for the open Project when `active`, newest first.
 *
 * No poll: the daemon pushes `review.changed` and ReviewCommentNotificationBridge
 * turns that into an exact invalidation of the typed comments identity.
 */
export function useReviewComments(active: boolean): ReviewComment[] {
  const project = useActiveProject()
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? 'none'
  const projectPath = project?.path ?? null
  const enabled = active && project !== null && isPaired(environment)

  const query = useQuery({
    enabled,
    queryKey: projectPath
      ? reviewCommentsQueryKey(environmentId, projectPath)
      : (['daemon', environmentId, reviewCommentsQuery('')] as const),
    queryFn: async (): Promise<ReviewComment[]> => {
      if (projectPath === null || !isPaired(environment)) return []
      return callDaemon(getDaemonClient(environment), reviewCommentsProcedure, projectPath)
    },
  })

  return query.data ?? []
}

/** Memoized presentation index for one path over a provided list (pure derivation). */
export function useCommentIndex(comments: readonly ReviewComment[], path: string): CommentIndex {
  return useMemo(() => buildCommentIndex(comments, path), [comments, path])
}

/** New-side commented lines per file over a provided list. */
export function useCommentedLinesByPath(
  comments: readonly ReviewComment[],
): Map<string, Set<number>> {
  return useMemo(() => commentedLinesByPath(comments), [comments])
}
