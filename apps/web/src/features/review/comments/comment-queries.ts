import type { ReviewComment } from '@porcelain/contracts/review'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { buildCommentIndex, type CommentIndex } from './comment-index'
import { reviewCommentsKeyForProject } from './comment-query-key'

/**
 * Review comments read adapter (RVC-003).
 *
 * Binds RVC-002 `reviewCommentsQuery` + daemon identity to React Query and invokes the
 * RVC-001 `reviewComments` procedure through the Web tRPC client. Empty and unloaded remain
 * indistinguishable to callers (`[]`), matching the pre-cutover surface.
 */

/** All review comments for the current Project (newest first; live-refreshed). */
export function useReviewComments(): ReviewComment[] {
  const repo = useRepoStore((s) => s.repo)
  const daemon = useDaemonIdentity()
  const projectPath = repo?.path ?? null
  const daemonScope: DaemonScope = { host: daemon.host, version: daemon.version }
  const utils = trpc.useUtils()

  const query = useQuery({
    queryKey: projectPath
      ? reviewCommentsKeyForProject(daemonScope, projectPath)
      : ([{ domain: 'review', name: 'comments', projectPath: '' }, daemonScope] as const),
    queryFn: async (): Promise<ReviewComment[]> => {
      if (projectPath === null) return []
      return utils.client.reviewComments.query(projectPath)
    },
    enabled: projectPath !== null,
  })

  return query.data ?? []
}

/** Memoized per-file presentation index over the live comment list. */
export function useCommentIndex(path: string): CommentIndex {
  const comments = useReviewComments()
  return useMemo(() => buildCommentIndex(comments, path), [comments, path])
}
