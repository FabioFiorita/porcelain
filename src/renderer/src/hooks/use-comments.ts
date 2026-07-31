import type { ReviewComment } from '@backend/comment-store'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { randomId } from '@renderer/lib/utils'
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

/** Optimistic-update rollback context: the pre-mutation cache snapshot for one repo. */
type MutationContext = { previous: ReviewComment[] | undefined; repoPath: string }

type AddCommentVars = {
  repoPath: string
  path: string
  startLine?: number
  endLine?: number
  anchorText?: string
  body: string
}
type EditCommentVars = { repoPath: string; id: string; body: string }
type DeleteCommentVars = { repoPath: string; id: string }
type ResolveCommentVars = { repoPath: string; id: string; resolved: boolean }
type ClearResolvedVars = { repoPath: string }

/** The id an optimistically-added comment carries until the server's real one arrives on
 *  the reconciling refetch. Never sent to the daemon, never written to the channel. */
function temporaryId(): string {
  return `optimistic-${randomId()}`
}

/**
 * Add/edit/delete/resolve review comments. Each mutation writes the cache optimistically
 * and reconciles on settle. The comment channel has no poll (only the `comments` app event
 * refreshes it), so the optimistic value stands until real data replaces it.
 */
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

  // No-op until the list has loaded — seeding a cache entry from a single write would
  // publish a list that is missing every comment the query has not fetched yet.
  const patch = (repoPath: string, next: (comments: ReviewComment[]) => ReviewComment[]): void => {
    utils.reviewComments.setData(repoPath, (comments) => (comments ? next(comments) : undefined))
  }
  const begin = async (
    repoPath: string,
    next: (comments: ReviewComment[]) => ReviewComment[],
  ): Promise<MutationContext> => {
    await utils.reviewComments.cancel(repoPath)
    const previous = utils.reviewComments.getData(repoPath)
    patch(repoPath, next)
    return { previous, repoPath }
  }
  const rollback = (context: MutationContext | undefined): void => {
    if (context) utils.reviewComments.setData(context.repoPath, context.previous)
  }

  const add = trpc.addReviewComment.useMutation({
    onMutate: ({
      repoPath,
      path,
      startLine,
      endLine,
      anchorText,
      body,
    }: AddCommentVars): Promise<MutationContext> => {
      const comment: ReviewComment = {
        id: temporaryId(),
        path,
        body,
        resolved: false,
        createdAt: Date.now(),
        ...(startLine !== undefined ? { startLine } : {}),
        ...(endLine !== undefined ? { endLine } : {}),
        ...(anchorText !== undefined ? { anchorText } : {}),
      }
      // Newest first, matching readComments' sort.
      return begin(repoPath, (comments) => [comment, ...comments])
    },
    onError: (
      error: { message: string },
      _vars: unknown,
      context: MutationContext | undefined,
    ): void => {
      rollback(context)
      onMutationError('Add comment')(error)
    },
    onSettled: async (
      _data: unknown,
      _error: unknown,
      { repoPath }: AddCommentVars,
    ): Promise<void> => {
      await utils.reviewComments.invalidate(repoPath)
    },
  })
  const edit = trpc.editReviewComment.useMutation({
    onMutate: ({ repoPath, id, body }: EditCommentVars): Promise<MutationContext> =>
      begin(repoPath, (comments) =>
        comments.map((comment) => (comment.id === id ? { ...comment, body } : comment)),
      ),
    onError: (
      error: { message: string },
      _vars: unknown,
      context: MutationContext | undefined,
    ): void => {
      rollback(context)
      onMutationError('Edit comment')(error)
    },
    onSettled: async (
      _data: unknown,
      _error: unknown,
      { repoPath }: EditCommentVars,
    ): Promise<void> => {
      await utils.reviewComments.invalidate(repoPath)
    },
  })
  const remove = trpc.deleteReviewComment.useMutation({
    onMutate: ({ repoPath, id }: DeleteCommentVars): Promise<MutationContext> =>
      begin(repoPath, (comments) => comments.filter((comment) => comment.id !== id)),
    onError: (
      error: { message: string },
      _vars: unknown,
      context: MutationContext | undefined,
    ): void => {
      rollback(context)
      onMutationError('Delete comment')(error)
    },
    onSettled: async (
      _data: unknown,
      _error: unknown,
      { repoPath }: DeleteCommentVars,
    ): Promise<void> => {
      await utils.reviewComments.invalidate(repoPath)
    },
  })
  const resolve = trpc.resolveReviewComment.useMutation({
    onMutate: ({ repoPath, id, resolved }: ResolveCommentVars): Promise<MutationContext> =>
      begin(repoPath, (comments) =>
        comments.map((comment) => (comment.id === id ? { ...comment, resolved } : comment)),
      ),
    onError: (
      error: { message: string },
      _vars: unknown,
      context: MutationContext | undefined,
    ): void => {
      rollback(context)
      onMutationError('Resolve comment')(error)
    },
    onSettled: async (
      _data: unknown,
      _error: unknown,
      { repoPath }: ResolveCommentVars,
    ): Promise<void> => {
      await utils.reviewComments.invalidate(repoPath)
    },
  })
  const clearResolved = trpc.clearResolvedReviewComments.useMutation({
    onMutate: ({ repoPath }: ClearResolvedVars): Promise<MutationContext> =>
      begin(repoPath, (comments) => comments.filter((comment) => !comment.resolved)),
    onError: (
      error: { message: string },
      _vars: unknown,
      context: MutationContext | undefined,
    ): void => {
      rollback(context)
      onMutationError('Clear closed comments')(error)
    },
    onSettled: async (
      _data: unknown,
      _error: unknown,
      { repoPath }: ClearResolvedVars,
    ): Promise<void> => {
      await utils.reviewComments.invalidate(repoPath)
    },
  })
  return {
    add: async (input: NewCommentInput): Promise<void> => {
      if (!repo) return
      await add.mutateAsync({ repoPath: repo.path, ...input })
    },
    edit: async (id: string, body: string): Promise<void> => {
      if (!repo) return
      await edit.mutateAsync({ repoPath: repo.path, id, body })
    },
    remove: async (id: string): Promise<void> => {
      if (!repo) return
      await remove.mutateAsync({ repoPath: repo.path, id })
    },
    setResolved: async (id: string, resolved: boolean): Promise<void> => {
      if (!repo) return
      await resolve.mutateAsync({ repoPath: repo.path, id, resolved })
    },
    clearResolved: async (): Promise<void> => {
      if (!repo) return
      await clearResolved.mutateAsync({ repoPath: repo.path })
    },
  }
}
