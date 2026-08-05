import { useMemo } from 'react'

import {
  addReviewCommentMutation,
  clearResolvedReviewCommentsMutation,
  deleteReviewCommentMutation,
  editReviewCommentMutation,
  type ReviewComment,
  resolveReviewCommentMutation,
  reviewCommentsQuery,
} from '@/lib/daemon/procedures/review'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

import { buildCommentIndex, type CommentIndex, commentedLinesByPath } from './comment-index'

const COMMENT_INVALIDATIONS = ['reviewComments'] as const

/**
 * Every review comment for the open repo, newest first. The daemon pushes a `comments` app
 * event when the agent replies or resolves one, so this needs no poll.
 */
export function useReviewComments(active: boolean): ReviewComment[] {
  const repo = useActiveRepo()
  const { data } = useDaemonQuery(reviewCommentsQuery, repo?.path ?? '', {
    enabled: active && repo !== null,
  })
  return data ?? []
}

export function useCommentIndex(comments: readonly ReviewComment[], path: string): CommentIndex {
  return useMemo(() => buildCommentIndex(comments, path), [comments, path])
}

/** New-side commented lines per file, memoized for the continuous read-all surface. */
export function useCommentedLinesByPath(
  comments: readonly ReviewComment[],
): Map<string, Set<number>> {
  return useMemo(() => commentedLinesByPath(comments), [comments])
}

export type NewComment = {
  /** Repo-relative path. */
  path: string
  body: string
  startLine?: number
  endLine?: number
  anchorText?: string
}

export function useCommentActions(): {
  add: (comment: NewComment) => Promise<void>
  /** Rewrites the body in place — the anchor, the resolved flag and the agent's reply all stay. */
  edit: (id: string, body: string) => Promise<void>
  remove: (id: string) => Promise<void>
  setResolved: (id: string, resolved: boolean) => Promise<void>
  clearResolved: () => Promise<void>
  isPending: boolean
  error: Error | null
} {
  const repo = useActiveRepo()
  const add = useDaemonMutation(addReviewCommentMutation, { invalidates: COMMENT_INVALIDATIONS })
  const edit = useDaemonMutation(editReviewCommentMutation, {
    invalidates: COMMENT_INVALIDATIONS,
  })
  const remove = useDaemonMutation(deleteReviewCommentMutation, {
    invalidates: COMMENT_INVALIDATIONS,
  })
  const resolve = useDaemonMutation(resolveReviewCommentMutation, {
    invalidates: COMMENT_INVALIDATIONS,
  })
  const clear = useDaemonMutation(clearResolvedReviewCommentsMutation, {
    invalidates: COMMENT_INVALIDATIONS,
  })

  return {
    add: async (comment: NewComment): Promise<void> => {
      if (repo === null) return
      await add.mutateAsync({ ...comment, repoPath: repo.path })
    },
    clearResolved: async (): Promise<void> => {
      if (repo === null) return
      await clear.mutateAsync({ repoPath: repo.path })
    },
    edit: async (id: string, body: string): Promise<void> => {
      if (repo === null) return
      await edit.mutateAsync({ body, id, repoPath: repo.path })
    },
    error: add.error ?? edit.error ?? remove.error ?? resolve.error ?? clear.error,
    isPending:
      add.isPending || edit.isPending || remove.isPending || resolve.isPending || clear.isPending,
    remove: async (id: string): Promise<void> => {
      if (repo === null) return
      await remove.mutateAsync({ id, repoPath: repo.path })
    },
    setResolved: async (id: string, resolved: boolean): Promise<void> => {
      if (repo === null) return
      await resolve.mutateAsync({ id, repoPath: repo.path, resolved })
    },
  }
}
