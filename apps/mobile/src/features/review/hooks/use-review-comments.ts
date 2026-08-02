import type { UseQueryResult } from '@tanstack/react-query'
import { useIsFocused } from 'expo-router'

import type { DaemonError } from '@/lib/daemon/errors'
import {
  addReviewCommentMutation,
  deleteReviewCommentMutation,
  editReviewCommentMutation,
  type ReviewComment,
  reviewCommentsQuery,
} from '@/lib/daemon/procedures/review'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

export function useReviewComments(): UseQueryResult<ReviewComment[], DaemonError> {
  const repo = useActiveRepo()
  const focused = useIsFocused()
  return useDaemonQuery(reviewCommentsQuery, repo?.path ?? '', {
    enabled: repo !== null && focused,
  })
}

export function useReviewCommentActions(): {
  add(path: string, body: string): Promise<void>
  edit(id: string, body: string): Promise<void>
  remove(id: string): Promise<void>
} {
  const repo = useActiveRepo()
  const addMutation = useDaemonMutation(addReviewCommentMutation, {
    invalidates: ['reviewComments'],
  })
  const editMutation = useDaemonMutation(editReviewCommentMutation, {
    invalidates: ['reviewComments'],
  })
  const deleteMutation = useDaemonMutation(deleteReviewCommentMutation, {
    invalidates: ['reviewComments'],
  })

  return {
    add: async (path: string, body: string): Promise<void> => {
      if (repo === null) return
      await addMutation.mutateAsync({ body, path, repoPath: repo.path })
    },
    edit: async (id: string, body: string): Promise<void> => {
      if (repo === null) return
      await editMutation.mutateAsync({ body, id, repoPath: repo.path })
    },
    remove: async (id: string): Promise<void> => {
      if (repo === null) return
      await deleteMutation.mutateAsync({ id, repoPath: repo.path })
    },
  }
}
