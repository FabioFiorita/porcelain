// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { normalizePublicError } from '../../daemon-composition/public-error'
import type { ReviewLifecycleOperations } from './review-lifecycle-operations'
import { createReviewLifecycleRouter } from './review-lifecycle-router'

const REQUEST_ID = '00000000-0000-4000-8000-000000000021'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }
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

function lifecycleOps(
  overrides: Partial<ReviewLifecycleOperations> = {},
  calls: unknown[] = [],
): ReviewLifecycleOperations {
  return {
    archiveReview: async (input) => {
      calls.push(input)
      return { ok: true, value: undefined }
    },
    publishReview: async (input) => {
      calls.push(input)
      return { ok: true, value: { id: '2026-08-10-review', cost: { bytes: 2048, files: 3 } } }
    },
    publishCost: async (input) => {
      calls.push(input)
      return { ok: true, value: { bytes: 2048, files: 3 } }
    },
    archivedReviews: async (input) => {
      calls.push(input)
      return {
        ok: true,
        value: [
          {
            id: '2026-08-09-review',
            name: 'Earlier review',
            thesis: 'It shipped',
            archivedAt: '2026-08-09T00:00:00.000Z',
          },
        ],
      }
    },
    restoreArchivedReview: async (input) => {
      calls.push(input)
      return { ok: true, value: undefined }
    },
    deleteArchivedReview: async (input) => {
      calls.push(input)
      return { ok: true, value: undefined }
    },
    ...overrides,
  }
}

function failing(code: 'review.unavailable' = 'review.unavailable'): ReviewLifecycleOperations {
  const fail = async () => ({ ok: false as const, error: { code } })
  return lifecycleOps({
    archiveReview: fail,
    publishReview: fail,
    publishCost: fail,
    archivedReviews: fail,
    restoreArchivedReview: fail,
    deleteArchivedReview: fail,
  })
}

describe('review lifecycle router mapping', () => {
  it('serializes publish cost, publish result, and the archive list', async () => {
    const calls: unknown[] = []
    const caller = createReviewLifecycleRouter(lifecycleOps({}, calls)).createCaller(PUBLIC_CONTEXT)

    await expect(caller.publishCost(REPO)).resolves.toEqual({ bytes: 2048, files: 3 })
    await expect(caller.publishReview(REPO)).resolves.toEqual({
      id: '2026-08-10-review',
      cost: { bytes: 2048, files: 3 },
    })
    await expect(caller.archivedReviews(REPO)).resolves.toEqual([
      {
        id: '2026-08-09-review',
        name: 'Earlier review',
        thesis: 'It shipped',
        archivedAt: '2026-08-09T00:00:00.000Z',
      },
    ])
    expect(calls).toEqual([{ projectPath: REPO }, { projectPath: REPO }, { projectPath: REPO }])
  })

  it('serializes void lifecycle mutations and passes the wire input through once each', async () => {
    const calls: unknown[] = []
    const caller = createReviewLifecycleRouter(lifecycleOps({}, calls)).createCaller(PUBLIC_CONTEXT)

    await expect(caller.archiveReview(REPO)).resolves.toBeUndefined()
    await expect(
      caller.restoreArchivedReview({ repoPath: REPO, id: 'arc-1' }),
    ).resolves.toBeUndefined()
    await expect(
      caller.deleteArchivedReview({ repoPath: REPO, id: 'arc-1' }),
    ).resolves.toBeUndefined()
    expect(calls).toEqual([
      { projectPath: REPO },
      { projectPath: REPO, id: 'arc-1' },
      { projectPath: REPO, id: 'arc-1' },
    ])
  })

  it('serializes nothing to publish as null', async () => {
    const caller = createReviewLifecycleRouter(
      lifecycleOps({ publishReview: async () => ({ ok: true, value: null }) }),
    ).createCaller(PUBLIC_CONTEXT)

    await expect(caller.publishReview(REPO)).resolves.toBeNull()
  })

  it('rejects an empty archive id as request.invalid before any operation runs', async () => {
    const calls: unknown[] = []
    const router = createReviewLifecycleRouter(lifecycleOps({}, calls))

    for (const path of ['restoreArchivedReview', 'deleteArchivedReview']) {
      expectPublicCode(
        await rejected(() =>
          callTRPCProcedure({
            router,
            path,
            type: 'mutation',
            ctx: PUBLIC_CONTEXT,
            getRawInput: async () => ({ repoPath: REPO, id: '' }),
            signal: undefined,
            batchIndex: 0,
          }),
        ),
        'request.invalid',
        false,
      )
    }
    expect(calls).toEqual([])
  })

  it('refuses to serialize an archived review row with an unknown key', async () => {
    const caller = createReviewLifecycleRouter(
      lifecycleOps({
        archivedReviews: async () => ({
          ok: true,
          value: [
            {
              id: '2026-08-09-review',
              name: 'Earlier review',
              archivedAt: '2026-08-09T00:00:00.000Z',
              stale: true,
            },
          ] as never,
        }),
      }),
    ).createCaller(PUBLIC_CONTEXT)

    expectPublicCode(
      await rejected(() => caller.archivedReviews(REPO)),
      'internal.unexpected',
      true,
    )
  })

  it('surfaces an operation failure as the review.unavailable public error', async () => {
    const caller = createReviewLifecycleRouter(failing()).createCaller(PUBLIC_CONTEXT)

    expectPublicCode(await rejected(() => caller.publishReview(REPO)), 'review.unavailable', false)
    expectPublicCode(await rejected(() => caller.archiveReview(REPO)), 'review.unavailable', false)
    expectPublicCode(
      await rejected(() => caller.restoreArchivedReview({ repoPath: REPO, id: 'arc-1' })),
      'review.unavailable',
      false,
    )
  })
})
