import {
  type ReviewComment,
  reviewCommentSchema,
  reviewContractFixtures,
} from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'
import { reviewCommentMutations } from './comment-mutations'
import {
  applyReviewCommentOptimisticTransition,
  reconcileReviewCommentMutation,
  rollbackReviewCommentOptimisticTransition,
} from './comment-reconciliation'

const TEMP_ID = 'optimistic-synthetic-temp'
const NOW = 1_700_000_000_000
const OPTIMISTIC = { temporaryId: TEMP_ID, now: NOW } as const

const fixtures = reviewContractFixtures

const withAgentReply: ReviewComment = reviewCommentSchema.parse(fixtures.reviewComments.output[0])

const resolvedSibling: ReviewComment = reviewCommentSchema.parse({
  id: 'comment-resolved-sibling',
  path: 'src/other.ts',
  body: 'Resolved sibling.',
  resolved: true,
  createdAt: 1_754_737_500_000,
})

const baseComments: readonly ReviewComment[] = [withAgentReply, resolvedSibling]

describe('applyReviewCommentOptimisticTransition', () => {
  it('prepends an add comment with temporaryId, now, optional anchors, and no agentReply', () => {
    const { comments, snapshot } = applyReviewCommentOptimisticTransition(
      baseComments,
      'add',
      fixtures.addReviewComment.input,
      OPTIMISTIC,
    )

    expect(snapshot.comments).toEqual(baseComments)
    expect(comments).toHaveLength(baseComments.length + 1)
    expect(comments[0]).toEqual({
      id: TEMP_ID,
      path: fixtures.addReviewComment.input.path,
      body: fixtures.addReviewComment.input.body,
      resolved: false,
      createdAt: NOW,
      startLine: fixtures.addReviewComment.input.startLine,
      endLine: fixtures.addReviewComment.input.endLine,
      anchorText: fixtures.addReviewComment.input.anchorText,
    })
    expect(comments[0]).not.toHaveProperty('agentReply')
    // Newest-first: temporary comment is first.
    expect(comments.slice(1)).toEqual(baseComments)
  })

  it('omits undefined optional anchor fields on add', () => {
    const { comments } = applyReviewCommentOptimisticTransition(
      baseComments,
      'add',
      {
        repoPath: fixtures.addReviewComment.input.repoPath,
        path: 'src/plain.ts',
        body: 'No anchors.',
      },
      OPTIMISTIC,
    )
    expect(comments[0]).toEqual({
      id: TEMP_ID,
      path: 'src/plain.ts',
      body: 'No anchors.',
      resolved: false,
      createdAt: NOW,
    })
    expect(comments[0]).not.toHaveProperty('startLine')
    expect(comments[0]).not.toHaveProperty('endLine')
    expect(comments[0]).not.toHaveProperty('anchorText')
    expect(comments[0]).not.toHaveProperty('agentReply')
  })

  it('edits body only and preserves agentReply and anchors', () => {
    const { comments } = applyReviewCommentOptimisticTransition(
      baseComments,
      'edit',
      fixtures.editReviewComment.input,
      OPTIMISTIC,
    )
    const edited = comments.find((comment) => comment.id === fixtures.editReviewComment.input.id)
    expect(edited?.body).toBe(fixtures.editReviewComment.input.body)
    expect(edited?.path).toBe(withAgentReply.path)
    expect(edited?.startLine).toBe(withAgentReply.startLine)
    expect(edited?.endLine).toBe(withAgentReply.endLine)
    expect(edited?.anchorText).toBe(withAgentReply.anchorText)
    expect(edited?.resolved).toBe(withAgentReply.resolved)
    expect(edited?.createdAt).toBe(withAgentReply.createdAt)
    expect(edited?.agentReply).toEqual(withAgentReply.agentReply)
  })

  it('removes one comment on delete', () => {
    const { comments } = applyReviewCommentOptimisticTransition(
      baseComments,
      'delete',
      fixtures.deleteReviewComment.input,
      OPTIMISTIC,
    )
    expect(comments.some((comment) => comment.id === fixtures.deleteReviewComment.input.id)).toBe(
      false,
    )
    expect(comments).toHaveLength(baseComments.length - 1)
    expect(comments).toEqual([resolvedSibling])
  })

  it('toggles only resolved on setResolved', () => {
    const { comments } = applyReviewCommentOptimisticTransition(
      baseComments,
      'setResolved',
      fixtures.resolveReviewComment.input,
      OPTIMISTIC,
    )
    const updated = comments.find(
      (comment) => comment.id === fixtures.resolveReviewComment.input.id,
    )
    expect(updated?.resolved).toBe(true)
    expect(updated?.body).toBe(withAgentReply.body)
    expect(updated?.path).toBe(withAgentReply.path)
    expect(updated?.agentReply).toEqual(withAgentReply.agentReply)
    expect(updated?.startLine).toBe(withAgentReply.startLine)
  })

  it('removes only resolved comments on clearResolved', () => {
    const { comments } = applyReviewCommentOptimisticTransition(
      baseComments,
      'clearResolved',
      fixtures.clearResolvedReviewComments.input,
      OPTIMISTIC,
    )
    expect(comments.every((comment) => comment.resolved === false)).toBe(true)
    expect(comments).toEqual([withAgentReply])
  })

  it('returns empty collection when clearResolved removes every comment', () => {
    const onlyResolved: readonly ReviewComment[] = [resolvedSibling]
    const { comments } = applyReviewCommentOptimisticTransition(
      onlyResolved,
      'clearResolved',
      fixtures.clearResolvedReviewComments.input,
      OPTIMISTIC,
    )
    expect(comments).toEqual([])
  })

  it('leaves the collection unchanged for an absent id', () => {
    const missing = 'comment-missing-id'
    for (const mutation of ['edit', 'delete', 'setResolved'] as const) {
      const input =
        mutation === 'edit'
          ? {
              repoPath: fixtures.editReviewComment.input.repoPath,
              id: missing,
              body: 'X',
            }
          : mutation === 'delete'
            ? { repoPath: fixtures.deleteReviewComment.input.repoPath, id: missing }
            : {
                repoPath: fixtures.resolveReviewComment.input.repoPath,
                id: missing,
                resolved: true,
              }

      const { comments, snapshot } = applyReviewCommentOptimisticTransition(
        baseComments,
        mutation,
        input,
        OPTIMISTIC,
      )
      expect(comments).toEqual(baseComments)
      expect(snapshot.comments).toEqual(baseComments)
    }
  })
})

describe('rollbackReviewCommentOptimisticTransition', () => {
  it('returns the exact pre-mutation comments reference', () => {
    const original: readonly ReviewComment[] = [
      reviewCommentSchema.parse({
        id: 'comment-rollback-only',
        path: 'src/a.ts',
        body: 'Before',
        resolved: false,
        createdAt: 1,
      }),
    ]
    const { snapshot } = applyReviewCommentOptimisticTransition(
      original,
      'add',
      fixtures.addReviewComment.input,
      OPTIMISTIC,
    )
    expect(rollbackReviewCommentOptimisticTransition(snapshot)).toEqual(original)
    expect(rollbackReviewCommentOptimisticTransition(snapshot)).toBe(snapshot.comments)
  })
})

describe('reconcileReviewCommentMutation', () => {
  it('replaces a temporary add comment with the authoritative add result', () => {
    const { comments: optimistic } = applyReviewCommentOptimisticTransition(
      baseComments,
      'add',
      fixtures.addReviewComment.input,
      OPTIMISTIC,
    )
    const reconciled = reconcileReviewCommentMutation(optimistic, 'add', {
      temporaryId: TEMP_ID,
      result: fixtures.addReviewComment.output,
    })
    expect(reconciled.some((comment) => comment.id === TEMP_ID)).toBe(false)
    expect(reconciled[0]).toEqual(fixtures.addReviewComment.output)
    expect(reconciled).toHaveLength(optimistic.length)
    // Does not re-sort — first element is still the (now authoritative) add result.
    expect(reconciled.slice(1)).toEqual(baseComments)
  })

  it('returns the optimistic collection when add options are incomplete', () => {
    const { comments: optimistic } = applyReviewCommentOptimisticTransition(
      baseComments,
      'add',
      fixtures.addReviewComment.input,
      OPTIMISTIC,
    )
    expect(reconcileReviewCommentMutation(optimistic, 'add', { temporaryId: TEMP_ID })).toBe(
      optimistic,
    )
    expect(
      reconcileReviewCommentMutation(optimistic, 'add', {
        result: fixtures.addReviewComment.output,
      }),
    ).toBe(optimistic)
    expect(reconcileReviewCommentMutation(optimistic, 'add')).toBe(optimistic)
  })

  it('returns the optimistic collection for non-add mutations', () => {
    const { comments: optimistic } = applyReviewCommentOptimisticTransition(
      baseComments,
      'delete',
      fixtures.deleteReviewComment.input,
      OPTIMISTIC,
    )
    expect(
      reconcileReviewCommentMutation(optimistic, 'delete', {
        result: fixtures.addReviewComment.output,
      }),
    ).toBe(optimistic)
  })

  it('declares authoritative refetch on every Review-comment mutation definition', () => {
    for (const definition of Object.values(reviewCommentMutations)) {
      expect(definition.requiresAuthoritativeRefetch).toBe(true)
    }
  })
})
