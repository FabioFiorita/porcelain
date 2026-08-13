// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { normalizePublicError } from '../../daemon-composition/public-error'
import type { ReviewEvidencePack } from './review-evidence-capabilities'
import type { ReviewEvidenceOperations } from './review-evidence-operations'
import { createReviewEvidenceRouter } from './review-evidence-router'

const REQUEST_ID = '00000000-0000-4000-8000-000000000041'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }
const REPO = '/synthetic/repo'

const RESULT = {
  file: 'run-log.md',
  label: 'Run log',
  medium: 'markdown',
  bytes: 12,
  state: 'available',
} as const

const ASSET = {
  file: 'shot.png',
  label: 'Shot',
  mime: 'image/png',
  kind: 'image',
  bytes: 2048,
  state: 'available',
} as const

const PACK: ReviewEvidencePack = {
  title: 'Evidence',
  updatedAt: '2026-08-11T00:00:00.000Z',
  checks: [{ label: 'pnpm lint', status: 'pass' }],
  results: [RESULT],
  assets: [ASSET],
}

const DOC = { file: 'run-log.md', label: 'Run log', medium: 'markdown', body: 'log' } as const
const BODY = {
  file: 'shot.png',
  mime: 'image/png',
  bytes: 2048,
  dataUrl: 'data:image/png;base64,AAAA',
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

function evidenceOps(
  overrides: Partial<ReviewEvidenceOperations> = {},
  calls: unknown[] = [],
): ReviewEvidenceOperations {
  return {
    readEvidencePack: async (input) => {
      calls.push(['readEvidencePack', input])
      return PACK
    },
    readEvidenceDoc: async (input) => {
      calls.push(['readEvidenceDoc', input])
      return DOC
    },
    readEvidenceAsset: async (input) => {
      calls.push(['readEvidenceAsset', input])
      return BODY
    },
    clearEvidence: async (input) => {
      calls.push(['clearEvidence', input])
    },
    ...overrides,
  }
}

describe('review evidence router mapping', () => {
  it('serializes the pack, one document, one asset body, and a void clear from one operation each', async () => {
    const calls: unknown[] = []
    const caller = createReviewEvidenceRouter(evidenceOps({}, calls)).createCaller(PUBLIC_CONTEXT)

    expect(await caller.reviewEvidence(REPO)).toEqual(PACK)
    expect(await caller.reviewEvidenceDoc({ repoPath: REPO, file: 'run-log.md' })).toEqual(DOC)
    expect(await caller.reviewEvidenceAsset({ repoPath: REPO, file: 'shot.png' })).toEqual(BODY)
    expect(await caller.clearEvidence(REPO)).toBeUndefined()

    expect(calls).toEqual([
      ['readEvidencePack', { projectPath: REPO }],
      ['readEvidenceDoc', { projectPath: REPO, file: 'run-log.md' }],
      ['readEvidenceAsset', { projectPath: REPO, file: 'shot.png' }],
      ['clearEvidence', { projectPath: REPO }],
    ])
  })

  it('carries checks plus Results and Assets descriptors, and no retired marker', async () => {
    const caller = createReviewEvidenceRouter(evidenceOps()).createCaller(PUBLIC_CONTEXT)

    const pack = await caller.reviewEvidence(REPO)

    expect(pack?.checks).toEqual([{ label: 'pnpm lint', status: 'pass' }])
    expect(pack?.results).toEqual([RESULT])
    expect(pack?.assets).toEqual([ASSET])
    expect(pack).not.toHaveProperty('dir')
    expect(pack).not.toHaveProperty('medium')
    expect(pack).not.toHaveProperty('hasReport')
  })

  it('describes an over-cap document and image as unavailable rather than dropping them', async () => {
    const caller = createReviewEvidenceRouter(
      evidenceOps({
        readEvidencePack: async () => ({
          ...PACK,
          results: [
            {
              ...RESULT,
              bytes: 9_000_000,
              state: 'unavailable',
              reason: 'too-large',
              maxBytes: 2 * 1024 * 1024,
            },
          ],
          assets: [
            {
              ...ASSET,
              bytes: 20_000_000,
              state: 'unavailable',
              reason: 'too-large',
              maxBytes: 8 * 1024 * 1024,
            },
          ],
        }),
      }),
    ).createCaller(PUBLIC_CONTEXT)

    const pack = await caller.reviewEvidence(REPO)
    expect(pack?.results[0]).toMatchObject({ state: 'unavailable', reason: 'too-large' })
    expect(pack?.assets[0]).toMatchObject({ state: 'unavailable', reason: 'too-large' })
  })

  it('serializes an absent pack, an absent document, and a missing asset as null', async () => {
    const caller = createReviewEvidenceRouter(
      evidenceOps({
        readEvidencePack: async () => null,
        readEvidenceDoc: async () => null,
        readEvidenceAsset: async () => null,
      }),
    ).createCaller(PUBLIC_CONTEXT)

    expect(await caller.reviewEvidence(REPO)).toBeNull()
    expect(await caller.reviewEvidenceDoc({ repoPath: REPO, file: 'gone.md' })).toBeNull()
    expect(await caller.reviewEvidenceAsset({ repoPath: REPO, file: 'gone.png' })).toBeNull()
  })

  it('rejects an empty evidence asset or document name before any operation runs', async () => {
    const calls: unknown[] = []
    const router = createReviewEvidenceRouter(evidenceOps({}, calls))

    for (const path of ['reviewEvidenceAsset', 'reviewEvidenceDoc']) {
      expectPublicCode(
        await rejected(() =>
          callTRPCProcedure({
            router,
            path,
            type: 'query',
            ctx: PUBLIC_CONTEXT,
            getRawInput: async () => ({ repoPath: REPO, file: '' }),
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

  it('refuses to serialize a descriptor file name that escapes the evidence directory', async () => {
    const caller = createReviewEvidenceRouter(
      evidenceOps({
        readEvidencePack: async () => ({ ...PACK, assets: [{ ...ASSET, file: '../escape.png' }] }),
      }),
    ).createCaller(PUBLIC_CONTEXT)

    expectPublicCode(await rejected(() => caller.reviewEvidence(REPO)), 'internal.unexpected', true)
  })

  it('refuses to serialize a check status that violates the contract', async () => {
    const caller = createReviewEvidenceRouter(
      evidenceOps({
        readEvidencePack: async () =>
          ({ ...PACK, checks: [{ label: 'pnpm verify', status: 'exploded' }] }) as never,
      }),
    ).createCaller(PUBLIC_CONTEXT)

    expectPublicCode(await rejected(() => caller.reviewEvidence(REPO)), 'internal.unexpected', true)
  })

  it('surfaces a thrown operation failure as internal.unexpected, unchanged from the legacy router', async () => {
    const caller = createReviewEvidenceRouter(
      evidenceOps({
        readEvidenceDoc: async () => {
          throw new Error('disk exploded')
        },
      }),
    ).createCaller(PUBLIC_CONTEXT)

    expectPublicCode(
      await rejected(() => caller.reviewEvidenceDoc({ repoPath: REPO, file: 'run-log.md' })),
      'internal.unexpected',
      true,
    )
  })
})
