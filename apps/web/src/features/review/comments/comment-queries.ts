import type { ReviewComment, ReviewCommentAnchor } from '@porcelain/contracts/review'
import { hubOwnerClient, useHubRepoOwner } from '@renderer/hooks/use-hub-owner'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { buildCommentIndex, type CommentIndex } from './comment-index'
import { reviewCommentsKeyForProject } from './comment-query-key'

/**
 * Review comments read adapter.
 *
 * Binds shared `reviewCommentsQuery` + daemon identity to React Query and invokes the
 * `reviewComments` procedure through the Web tRPC client. Empty and unloaded remain
 * indistinguishable to callers (`[]`).
 */

/** All review comments for the current Project (newest first; live-refreshed). */
export function useReviewComments(): ReviewComment[] {
  const { repoPath: projectPath, daemon, owner } = useHubRepoOwner()

  const query = useQuery({
    queryKey: projectPath
      ? reviewCommentsKeyForProject(daemon, projectPath)
      : ([{ domain: 'review', name: 'comments', projectPath: '' }, daemon] as const),
    queryFn: async (): Promise<ReviewComment[]> => {
      if (projectPath === null) return []
      return hubOwnerClient(owner).reviewComments.query(projectPath)
    },
    enabled: projectPath !== null && owner !== null,
  })

  return query.data ?? []
}

/** Memoized per-file presentation index over the live comment list. */
export function useCommentIndex(
  path: string,
  scope?: Extract<ReviewCommentAnchor, { kind: 'file' }>['scope'],
): CommentIndex {
  const comments = useReviewComments()
  return useMemo(() => buildCommentIndex(comments, path, scope), [comments, path, scope])
}
