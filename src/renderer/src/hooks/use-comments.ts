import type { ReviewComment } from '@backend/comment-store'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { useMemo } from 'react'

/** All review comments for the current repo (newest first; live-refreshed on agent resolve). */
export function useReviewComments(): ReviewComment[] {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.reviewComments.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return data ?? []
}

/** A file's comments split into per-line and file-level lookups, for viewer markers. */
export interface CommentIndex {
  /** Comments covering each 1-based line (a range expands to every line it spans). */
  byLine: Map<number, ReviewComment[]>
  /** Comments anchored to the whole file (no line range). */
  fileLevel: ReviewComment[]
}

/**
 * Build the per-line / file-level comment lookup for one file. Pure and exported so the
 * derivation is unit-testable without a query. A range comment (`startLine..endLine`) is
 * expanded into every line it covers, so a per-row marker lookup is O(1).
 */
export function buildCommentIndex(comments: readonly ReviewComment[], path: string): CommentIndex {
  const byLine = new Map<number, ReviewComment[]>()
  const fileLevel: ReviewComment[] = []
  for (const comment of comments) {
    if (comment.path !== path) continue
    if (comment.startLine === undefined) {
      fileLevel.push(comment)
      continue
    }
    const end = comment.endLine ?? comment.startLine
    for (let line = comment.startLine; line <= end; line++) {
      const list = byLine.get(line)
      if (list) list.push(comment)
      else byLine.set(line, [comment])
    }
  }
  return { byLine, fileLevel }
}

/** The comment index for one repo-relative file path, memoized over the live comment list. */
export function useCommentIndex(path: string): CommentIndex {
  const comments = useReviewComments()
  return useMemo(() => buildCommentIndex(comments, path), [comments, path])
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
  /** Permanently delete every resolved (closed) comment for the current repo. */
  clearResolved: () => Promise<void>
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const refresh = async (): Promise<void> => {
    await utils.reviewComments.invalidate()
  }
  const add = trpc.addReviewComment.useMutation({
    onSuccess: refresh,
    onError: onMutationError('Add comment'),
  })
  const edit = trpc.editReviewComment.useMutation({
    onSuccess: refresh,
    onError: onMutationError('Edit comment'),
  })
  const remove = trpc.deleteReviewComment.useMutation({
    onSuccess: refresh,
    onError: onMutationError('Delete comment'),
  })
  const resolve = trpc.resolveReviewComment.useMutation({
    onSuccess: refresh,
    onError: onMutationError('Resolve comment'),
  })
  const clearResolved = trpc.clearResolvedReviewComments.useMutation({
    onSuccess: refresh,
    onError: onMutationError('Clear closed comments'),
  })
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
    clearResolved: async () => {
      if (!repo) return
      await clearResolved.mutateAsync({ repoPath: repo.path })
    },
  }
}
