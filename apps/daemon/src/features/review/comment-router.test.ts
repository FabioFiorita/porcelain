// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { normalizePublicError } from '../../daemon-composition/public-error'
import type { ReviewCommentOperations } from './comment-operations'
import { createReviewCommentRouter } from './comment-router'

const REQUEST_ID = '00000000-0000-4000-8000-000000000019'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }
const ID = 'comment-a1'
const REPO = '/synthetic/repo'

function expectPublicCode(error: unknown, code: string, unexpected: boolean) {
  const normalized = normalizePublicError(error, REQUEST_ID)
  expect(normalized.unexpected).toBe(unexpected)
  expect(publicErrorSchema.parse(normalized.error)).toMatchObject({ code, requestId: REQUEST_ID })
}

async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('Expected a tRPC rejection')
}

function unavailableOps(overrides: Partial<ReviewCommentOperations> = {}): ReviewCommentOperations {
  return {
    listReviewComments: async () => ({ ok: true, value: [] }),
    addReviewComment: async () => ({ ok: false, error: { code: 'review.unavailable' } }),
    editReviewComment: async () => ({ ok: false, error: { code: 'review.unavailable' } }),
    answerReviewComment: async () => ({ ok: false, error: { code: 'review.unavailable' } }),
    deleteReviewComment: async () => ({ ok: false, error: { code: 'review.unavailable' } }),
    resolveReviewComment: async () => ({ ok: false, error: { code: 'review.unavailable' } }),
    clearResolvedReviewComments: async () => ({
      ok: false,
      error: { code: 'review.unavailable' },
    }),
    ...overrides,
  }
}

describe('review comment router mapping', () => {
  it('maps list and add, returning authoritative comment output', async () => {
    const calls: unknown[] = []
    const router = createReviewCommentRouter(
      unavailableOps({
        listReviewComments: async (input) => {
          calls.push(input)
          return {
            ok: true,
            value: [
              {
                id: ID,
                path: 'src/a.ts',
                body: 'note',
                resolved: false,
                createdAt: 1,
              },
            ],
          }
        },
        addReviewComment: async (input) => {
          calls.push(input)
          return {
            ok: true,
            value: {
              id: ID,
              path: input.path,
              body: input.body,
              resolved: false,
              createdAt: 2,
            },
          }
        },
      }),
    )
    const caller = router.createCaller(PUBLIC_CONTEXT)

    await expect(caller.reviewComments(REPO)).resolves.toEqual([
      { id: ID, path: 'src/a.ts', body: 'note', resolved: false, createdAt: 1 },
    ])
    await expect(
      caller.addReviewComment({ repoPath: REPO, path: 'src/a.ts', body: 'note' }),
    ).resolves.toMatchObject({ id: ID, body: 'note', resolved: false })
    expect(calls).toEqual([
      { projectPath: REPO },
      {
        projectPath: REPO,
        path: 'src/a.ts',
        body: 'note',
        startLine: undefined,
        endLine: undefined,
        anchorText: undefined,
      },
    ])
  })

  it('surfaces review.comment-not-found, request.invalid, and review.unavailable', async () => {
    const notFound = createReviewCommentRouter(
      unavailableOps({
        editReviewComment: async () => ({
          ok: false,
          error: { code: 'review.comment-not-found', commentId: ID },
        }),
      }),
    )
    expectPublicCode(
      await rejected(() =>
        notFound.createCaller(PUBLIC_CONTEXT).editReviewComment({
          repoPath: REPO,
          id: ID,
          body: 'x',
        }),
      ),
      'review.comment-not-found',
      false,
    )

    const invalid = createReviewCommentRouter(
      unavailableOps({
        addReviewComment: async () => ({ ok: false, error: { code: 'request.invalid' } }),
      }),
    )
    expectPublicCode(
      await rejected(() =>
        invalid.createCaller(PUBLIC_CONTEXT).addReviewComment({
          repoPath: REPO,
          path: 'a.ts',
          body: 'x',
          startLine: 5,
          endLine: 2,
        }),
      ),
      'request.invalid',
      false,
    )

    const unavailable = createReviewCommentRouter(
      unavailableOps({
        listReviewComments: async () => ({
          ok: false,
          error: { code: 'review.unavailable' },
        }),
      }),
    )
    expectPublicCode(
      await rejected(() => unavailable.createCaller(PUBLIC_CONTEXT).reviewComments(REPO)),
      'review.unavailable',
      false,
    )
  })

  it('returns void for edit/delete/resolve/clear and rejects invalid wire input', async () => {
    const router = createReviewCommentRouter(
      unavailableOps({
        editReviewComment: async () => ({ ok: true, value: undefined }),
        deleteReviewComment: async () => ({ ok: true, value: undefined }),
        resolveReviewComment: async () => ({ ok: true, value: undefined }),
        clearResolvedReviewComments: async () => ({ ok: true, value: undefined }),
      }),
    )
    const caller = router.createCaller(PUBLIC_CONTEXT)
    await expect(
      caller.editReviewComment({ repoPath: REPO, id: ID, body: 'x' }),
    ).resolves.toBeUndefined()
    await expect(caller.deleteReviewComment({ repoPath: REPO, id: ID })).resolves.toBeUndefined()
    await expect(
      caller.resolveReviewComment({ repoPath: REPO, id: ID, resolved: true }),
    ).resolves.toBeUndefined()
    await expect(caller.clearResolvedReviewComments({ repoPath: REPO })).resolves.toBeUndefined()

    let called = false
    const guarded = createReviewCommentRouter(
      unavailableOps({
        addReviewComment: async () => {
          called = true
          return { ok: false, error: { code: 'review.unavailable' } }
        },
      }),
    )
    const error = await rejected(() =>
      callTRPCProcedure({
        router: guarded,
        path: 'addReviewComment',
        type: 'mutation',
        ctx: PUBLIC_CONTEXT,
        getRawInput: async () => ({ repoPath: REPO, path: 'a.ts', body: '' }),
        signal: undefined,
        batchIndex: 0,
      }),
    )
    expectPublicCode(error, 'request.invalid', false)
    expect(called).toBe(false)

    const blankIdError = await rejected(() =>
      callTRPCProcedure({
        router: guarded,
        path: 'deleteReviewComment',
        type: 'mutation',
        ctx: PUBLIC_CONTEXT,
        getRawInput: async () => ({ repoPath: REPO, id: '' }),
        signal: undefined,
        batchIndex: 0,
      }),
    )
    expectPublicCode(blankIdError, 'request.invalid', false)
  })

  it('keeps expectedFailure helper available for correlation fixtures', () => {
    expect(expectedFailure('review.unavailable').code).toBe('review.unavailable')
    expect(expectedFailure('review.comment-not-found', { commentId: ID }).details).toEqual({
      commentId: ID,
    })
  })
})
