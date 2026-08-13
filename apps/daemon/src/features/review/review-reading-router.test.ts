// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { normalizePublicError } from '../../daemon-composition/public-error'
import type { ReviewReadingOperations } from './review-reading-operations'
import { createReviewReadingRouter } from './review-reading-router'

const REQUEST_ID = '00000000-0000-4000-8000-000000000031'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }
const REPO = '/synthetic/repo'

const VIEW = {
  name: 'Review',
  fromAgent: true,
  sections: [],
  groups: [
    {
      layer: 'source',
      files: [
        {
          path: 'src/alpha.ts',
          source: 'changed',
          status: 'modified',
          additions: 3,
          deletions: 1,
        },
      ],
    },
  ],
}

const READING = {
  name: 'Review',
  sections: [],
  groups: [{ layer: 'source', files: [{ path: 'src/alpha.ts', source: 'changed', hunks: [] }] }],
  evidence: {
    title: 'Evidence',
    updatedAt: '2026-08-11T00:00:00.000Z',
    checks: [{ label: 'pnpm lint', status: 'pass' }],
  },
}

const EXPLORATION = { name: 'alpha.ts', sections: [], groups: [], evidence: null }

const INBOX_ROW = {
  path: '/synthetic/worktrees/feat',
  branch: 'work/alpha',
  changedCount: 3,
  hasReview: true,
}

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

function readingOps(
  overrides: Partial<ReviewReadingOperations> = {},
  calls: unknown[] = [],
): ReviewReadingOperations {
  return {
    readActiveReview: async (input) => {
      calls.push(input)
      return VIEW as never
    },
    readReviewReading: async (input) => {
      calls.push(input)
      return READING as never
    },
    exploreReview: async (input) => {
      calls.push(input)
      return EXPLORATION as never
    },
    listReviewInbox: async (input) => {
      calls.push(input)
      return [INBOX_ROW]
    },
    ...overrides,
  }
}

describe('review reading router mapping', () => {
  it('serializes the view, the reading, the exploration, and the inbox from one operation each', async () => {
    const calls: unknown[] = []
    const caller = createReviewReadingRouter(readingOps({}, calls)).createCaller(PUBLIC_CONTEXT)

    expect(await caller.activeReview(REPO)).toMatchObject({ name: 'Review', fromAgent: true })
    expect(await caller.reviewReading(REPO)).toMatchObject({
      name: 'Review',
      evidence: { title: 'Evidence' },
    })
    expect(
      await caller.exploreReading({ repoPath: REPO, seed: { kind: 'file', path: 'src/alpha.ts' } }),
    ).toEqual(EXPLORATION)
    expect(await caller.reviewInbox(REPO)).toEqual([INBOX_ROW])

    expect(calls).toEqual([
      { projectPath: REPO },
      { projectPath: REPO },
      { projectPath: REPO, seed: { kind: 'file', path: 'src/alpha.ts' } },
      { projectPath: REPO },
    ])
  })

  it('serializes the view and the reading as null without an agent review set', async () => {
    const caller = createReviewReadingRouter(
      readingOps({
        readActiveReview: async () => null,
        readReviewReading: async () => null,
      }),
    ).createCaller(PUBLIC_CONTEXT)

    expect(await caller.activeReview(REPO)).toBeNull()
    expect(await caller.reviewReading(REPO)).toBeNull()
  })

  it('rejects an exploration seed missing its symbol before any operation runs', async () => {
    const calls: unknown[] = []
    const router = createReviewReadingRouter(readingOps({}, calls))

    expectPublicCode(
      await rejected(() =>
        callTRPCProcedure({
          router,
          path: 'exploreReading',
          type: 'query',
          ctx: PUBLIC_CONTEXT,
          getRawInput: async () => ({
            repoPath: REPO,
            seed: { kind: 'symbol', path: 'src/alpha.ts' },
          }),
          signal: undefined,
          batchIndex: 0,
        }),
      ),
      'request.invalid',
      false,
    )
    expect(calls).toEqual([])
  })

  it('rejects an object where a bare repo-path query is contracted', async () => {
    const calls: unknown[] = []
    const router = createReviewReadingRouter(readingOps({}, calls))

    for (const path of ['activeReview', 'reviewReading', 'reviewInbox']) {
      expectPublicCode(
        await rejected(() =>
          callTRPCProcedure({
            router,
            path,
            type: 'query',
            ctx: PUBLIC_CONTEXT,
            getRawInput: async () => ({ repoPath: REPO }),
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

  it('refuses to serialize an inbox row with an unknown key', async () => {
    const caller = createReviewReadingRouter(
      readingOps({
        listReviewInbox: async () => [{ ...INBOX_ROW, stale: false }] as never,
      }),
    ).createCaller(PUBLIC_CONTEXT)

    expectPublicCode(await rejected(() => caller.reviewInbox(REPO)), 'internal.unexpected', true)
  })

  it('surfaces a thrown adapter failure as internal.unexpected, unchanged from the legacy routers', async () => {
    const caller = createReviewReadingRouter(
      readingOps({
        readReviewReading: async () => {
          throw new Error('git exploded')
        },
      }),
    ).createCaller(PUBLIC_CONTEXT)

    expectPublicCode(await rejected(() => caller.reviewReading(REPO)), 'internal.unexpected', true)
  })
})
