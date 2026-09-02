import { type ReviewCommentsQuery, reviewCommentsQuery } from '@porcelain/client-runtime/review'
import type { ReviewComment } from '@porcelain/contracts/review'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { useHubRepoPath } from '@/features/projects'
import { isPaired, useActiveEnvironment } from '@/features/remote'

import {
  addReviewCommentProcedure,
  callReviewDaemon,
  clearResolvedReviewCommentsProcedure,
  deleteReviewCommentProcedure,
  editReviewCommentProcedure,
  resolveReviewCommentProcedure,
  reviewCommentsProcedure,
} from './comment-procedures'

/**
 * Mobile's Review-comment server state.
 *
 * Deliberately thinner than the web adapter: no optimistic transitions and no per-project
 * mutation queue. Every comment mutation in the shared definitions declares
 * `requiresAuthoritativeRefetch`, so the daemon's own list is what lands either way, and on a
 * phone one round trip is cheaper to reason about than a cache the screen may be unmounted
 * before it reconciles. Writes go through one queue-free path and invalidate exactly the
 * identity they affect.
 */

/** The cache identity comments are read under, scoped to the Environment that answered. */
export function reviewCommentsKey(
  environmentId: string,
  identity: ReviewCommentsQuery,
): readonly ['daemon', string, ReviewCommentsQuery] {
  return ['daemon', environmentId, identity] as const
}

const DISABLED_COMMENTS = reviewCommentsQuery('')

/**
 * Every Review comment on the selected checkout, newest first.
 *
 * Empty and not-yet-loaded are the same answer, matching web — a surface that renders "no
 * comments" for a moment is honest; one that renders a count it invented is not.
 */
export function useReviewComments(active: boolean): readonly ReviewComment[] {
  const environment = useActiveEnvironment()
  const repoPath = useHubRepoPath()
  const enabled = active && isPaired(environment) && repoPath !== null
  const environmentId = environment?.id ?? 'none'
  const identity = repoPath === null ? DISABLED_COMMENTS : reviewCommentsQuery(repoPath)

  const query = useQuery({
    enabled,
    queryFn: async (): Promise<readonly ReviewComment[]> => {
      if (repoPath === null) throw new Error('reviewComments ran without a selected checkout')
      return callReviewDaemon(environment, reviewCommentsProcedure, repoPath)
    },
    queryKey: reviewCommentsKey(environmentId, identity),
  })

  return enabled ? (query.data ?? []) : []
}

/** What a human may do to a comment. There is no reply — see {@link ReviewCommentActions}. */
export type ReviewCommentActions = {
  /**
   * Add a comment. Replying is this with the anchor of the comment being answered: the wire
   * has no reply procedure, and `agentReply` is the daemon's to write when the agent answers.
   */
  add: (input: {
    path: string
    startLine?: number
    endLine?: number
    anchorText?: string
    body: string
  }) => Promise<void>
  edit: (id: string, body: string) => Promise<void>
  remove: (id: string) => Promise<void>
  setResolved: (id: string, resolved: boolean) => Promise<void>
  clearResolved: () => Promise<void>
  isPending: boolean
}

/** Add, edit, delete, resolve and clear, each refetching the daemon's authoritative list after. */
export function useCommentActions(): ReviewCommentActions {
  const environment = useActiveEnvironment()
  const repoPath = useHubRepoPath()
  const queryClient = useQueryClient()
  const environmentId = environment?.id ?? 'none'

  const invalidate = useCallback(async (): Promise<void> => {
    if (repoPath === null) return
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: reviewCommentsKey(environmentId, reviewCommentsQuery(repoPath)),
    })
  }, [environmentId, queryClient, repoPath])

  const add = useMutation({
    mutationFn: async (input: Parameters<ReviewCommentActions['add']>[0]) => {
      if (repoPath === null) throw new Error('addReviewComment ran without a selected checkout')
      // The anchor fields are optional on a `.strict()` schema, so an absent one is omitted
      // rather than sent as undefined.
      return callReviewDaemon(environment, addReviewCommentProcedure, {
        body: input.body,
        path: input.path,
        repoPath,
        ...(input.anchorText === undefined ? {} : { anchorText: input.anchorText }),
        ...(input.endLine === undefined ? {} : { endLine: input.endLine }),
        ...(input.startLine === undefined ? {} : { startLine: input.startLine }),
      })
    },
    onSettled: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (repoPath === null) throw new Error('deleteReviewComment ran without a selected checkout')
      return callReviewDaemon(environment, deleteReviewCommentProcedure, { id, repoPath })
    },
    onSettled: invalidate,
  })

  const edit = useMutation({
    mutationFn: async (input: { id: string; body: string }) => {
      if (repoPath === null) throw new Error('editReviewComment ran without a selected checkout')
      return callReviewDaemon(environment, editReviewCommentProcedure, { ...input, repoPath })
    },
    onSettled: invalidate,
  })

  const setResolved = useMutation({
    mutationFn: async (input: { id: string; resolved: boolean }) => {
      if (repoPath === null) throw new Error('resolveReviewComment ran without a selected checkout')
      return callReviewDaemon(environment, resolveReviewCommentProcedure, { ...input, repoPath })
    },
    onSettled: invalidate,
  })

  const clearResolved = useMutation({
    mutationFn: async () => {
      if (repoPath === null) throw new Error('clearResolved ran without a selected checkout')
      return callReviewDaemon(environment, clearResolvedReviewCommentsProcedure, { repoPath })
    },
    onSettled: invalidate,
  })

  return {
    add: async (input): Promise<void> => {
      await add.mutateAsync(input)
    },
    clearResolved: async (): Promise<void> => {
      await clearResolved.mutateAsync()
    },
    edit: async (id, body): Promise<void> => {
      await edit.mutateAsync({ body, id })
    },
    isPending:
      add.isPending ||
      edit.isPending ||
      remove.isPending ||
      setResolved.isPending ||
      clearResolved.isPending,
    remove: async (id): Promise<void> => {
      await remove.mutateAsync(id)
    },
    setResolved: async (id, resolved): Promise<void> => {
      await setResolved.mutateAsync({ id, resolved })
    },
  }
}
