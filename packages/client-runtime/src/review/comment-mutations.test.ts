import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorSchema } from '@porcelain/contracts'
import { reviewContractFixtures, reviewProcedures } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'
import { reviewCommentMutations } from './comment-mutations'
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
  it('binds each definition to exactly one canonical RVC-001 comment procedure', () => {
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
    const cases = [
      {
        definition: reviewCommentMutations.add,
        input: fixtures.addReviewComment.input,
      },
      {
        definition: reviewCommentMutations.edit,
        input: fixtures.editReviewComment.input,
      },
      {
        definition: reviewCommentMutations.delete,
        input: fixtures.deleteReviewComment.input,
      },
      {
        definition: reviewCommentMutations.setResolved,
        input: fixtures.resolveReviewComment.input,
      },
      {
        definition: reviewCommentMutations.clearResolved,
        input: fixtures.clearResolvedReviewComments.input,
      },
    ] as const

    for (const { definition, input } of cases) {
      const affected = definition.affectedQueries(input)
      expect(affected).toEqual([reviewCommentsQuery(input.repoPath)])
      expect(affected).toHaveLength(1)
      expect(affected[0]).not.toEqual(reviewCommentsQuery(OTHER_PATH))
      expect(definition.requiresAuthoritativeRefetch).toBe(true)
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
