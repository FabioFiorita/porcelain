import type { ReviewComment } from '@backend/comment-store'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

/** All review comments for the current repo (newest first; live-refreshed on agent resolve). */
export function useReviewComments(): ReviewComment[] {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.reviewComments.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return data ?? []
}

export interface NewCommentInput {
  /** Repo-relative path. */
  path: string
  startLine?: number
  endLine?: number
  anchorText?: string
  body: string
}

/** Add/edit/delete/resolve review comments. Each mutation refreshes the list. */
export function useCommentActions(): {
  add: (input: NewCommentInput) => Promise<void>
  edit: (id: string, body: string) => Promise<void>
  remove: (id: string) => Promise<void>
  setResolved: (id: string, resolved: boolean) => Promise<void>
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const refresh = async (): Promise<void> => {
    await utils.reviewComments.invalidate()
  }
  const add = trpc.addReviewComment.useMutation({ onSuccess: refresh })
  const edit = trpc.editReviewComment.useMutation({ onSuccess: refresh })
  const remove = trpc.deleteReviewComment.useMutation({ onSuccess: refresh })
  const resolve = trpc.resolveReviewComment.useMutation({ onSuccess: refresh })
  return {
    add: async (input) => {
      if (!repo) return
      await add.mutateAsync({ repoPath: repo.path, ...input })
    },
    edit: async (id, body) => {
      if (!repo) return
      await edit.mutateAsync({ repoPath: repo.path, id, body })
    },
    remove: async (id) => {
      if (!repo) return
      await remove.mutateAsync({ repoPath: repo.path, id })
    },
    setResolved: async (id, resolved) => {
      if (!repo) return
      await resolve.mutateAsync({ repoPath: repo.path, id, resolved })
    },
  }
}
