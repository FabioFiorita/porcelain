import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorSchema } from '@porcelain/contracts'
import { reviewContractFixtures, reviewProcedures } from '@porcelain/contracts/review'
import { mutableFixture } from '@porcelain/contracts/testing'
import { describe, expect, it } from 'vitest'
import { reviewCommentMutations } from './comment-mutations'
import type { ReviewCommentsQuery } from './comment-queries'
import { reviewCommentsQuery } from './comment-queries'

const OTHER_PATH = '/synthetic/other-repo'
const fixtures = reviewContractFixtures

const reviewProcedureCatalog = {
  procedures: {
    addReviewComment: reviewProcedures.addReviewComment,
    editReviewComment: reviewProcedures.editReviewComment,
    deleteReviewComment: reviewProcedures.deleteReviewComment,
    resolveReviewComment: reviewProcedures.resolveReviewComment,
    clearResolvedReviewComments: reviewProcedures.clearResolvedReviewComments,
  },
  notification: { parse: (value: unknown) => value },
  publicError: publicErrorSchema,
}

describe('reviewCommentMutations', () => {
  it('binds each definition to exactly one canonical Review-comment procedure', () => {
    expect(reviewCommentMutations.add.procedure).toBe(reviewProcedures.addReviewComment)
    expect(reviewCommentMutations.add.procedureName).toBe('addReviewComment')

    expect(reviewCommentMutations.edit.procedure).toBe(reviewProcedures.editReviewComment)
    expect(reviewCommentMutations.edit.procedureName).toBe('editReviewComment')

    expect(reviewCommentMutations.delete.procedure).toBe(reviewProcedures.deleteReviewComment)
    expect(reviewCommentMutations.delete.procedureName).toBe('deleteReviewComment')

    expect(reviewCommentMutations.setResolved.procedure).toBe(reviewProcedures.resolveReviewComment)
    expect(reviewCommentMutations.setResolved.procedureName).toBe('resolveReviewComment')

    expect(reviewCommentMutations.clearResolved.procedure).toBe(
      reviewProcedures.clearResolvedReviewComments,
    )
    expect(reviewCommentMutations.clearResolved.procedureName).toBe('clearResolvedReviewComments')
  })

  it('affects only the comments identity for the input repoPath', () => {
    // Resolved where the definition and its input are still paired. Carrying them through an
    // array unions the two fields independently, so `affectedQueries` ends up demanding the
    // intersection of every input shape and no fixture satisfies it.
    const bind = <Input extends { repoPath: string }>(
      definition: {
        readonly affectedQueries: (input: Input) => readonly ReviewCommentsQuery[]
        readonly requiresAuthoritativeRefetch: boolean
      },
      input: Input,
    ) => ({
      affected: definition.affectedQueries(input),
      repoPath: input.repoPath,
      requiresAuthoritativeRefetch: definition.requiresAuthoritativeRefetch,
    })

    const cases = [
      bind(reviewCommentMutations.add, mutableFixture(fixtures.addReviewComment.input)),
      bind(reviewCommentMutations.edit, mutableFixture(fixtures.editReviewComment.input)),
      bind(reviewCommentMutations.delete, mutableFixture(fixtures.deleteReviewComment.input)),
      bind(reviewCommentMutations.setResolved, mutableFixture(fixtures.resolveReviewComment.input)),
      bind(
        reviewCommentMutations.clearResolved,
        mutableFixture(fixtures.clearResolvedReviewComments.input),
      ),
    ]

    for (const bound of cases) {
      const affected = bound.affected
      expect(affected).toEqual([reviewCommentsQuery(bound.repoPath)])
      expect(affected).toHaveLength(1)
      expect(affected[0]).not.toEqual(reviewCommentsQuery(OTHER_PATH))
      expect(bound.requiresAuthoritativeRefetch).toBe(true)
    }
  })

  it('dispatches bound procedures through the validating daemon mock', async () => {
    const daemon = createValidatingDaemonMock(reviewProcedureCatalog, {
      addReviewComment: () => ({ ok: true, value: fixtures.addReviewComment.output }),
      editReviewComment: () => ({ ok: true, value: fixtures.editReviewComment.output }),
      deleteReviewComment: () => ({ ok: true, value: fixtures.deleteReviewComment.output }),
      resolveReviewComment: () => ({ ok: true, value: fixtures.resolveReviewComment.output }),
      clearResolvedReviewComments: () => ({
        ok: true,
        value: fixtures.clearResolvedReviewComments.output,
      }),
    })

    const outcomes = await Promise.all([
      daemon.dispatch({
        procedure: reviewCommentMutations.add.procedureName,
        kind: reviewCommentMutations.add.procedure.kind,
        input: fixtures.addReviewComment.input,
      }),
      daemon.dispatch({
        procedure: reviewCommentMutations.edit.procedureName,
        kind: reviewCommentMutations.edit.procedure.kind,
        input: fixtures.editReviewComment.input,
      }),
      daemon.dispatch({
        procedure: reviewCommentMutations.delete.procedureName,
        kind: reviewCommentMutations.delete.procedure.kind,
        input: fixtures.deleteReviewComment.input,
      }),
      daemon.dispatch({
        procedure: reviewCommentMutations.setResolved.procedureName,
        kind: reviewCommentMutations.setResolved.procedure.kind,
        input: fixtures.resolveReviewComment.input,
      }),
      daemon.dispatch({
        procedure: reviewCommentMutations.clearResolved.procedureName,
        kind: reviewCommentMutations.clearResolved.procedure.kind,
        input: fixtures.clearResolvedReviewComments.input,
      }),
    ])

    expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, true, true, true, true])
    expect(daemon.requests().map((request) => request.procedure)).toEqual([
      'addReviewComment',
      'editReviewComment',
      'deleteReviewComment',
      'resolveReviewComment',
      'clearResolvedReviewComments',
    ])
  })
})
