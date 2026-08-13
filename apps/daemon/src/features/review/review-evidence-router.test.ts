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

const PACK: ReviewEvidencePack = {
  title: 'Evidence',
  updatedAt: '2026-08-11T00:00:00.000Z',
  checks: [{ label: 'pnpm lint', status: 'pass' }],
  results: [{ file: 'run-log.md', label: 'Run log', medium: 'markdown', bytes: 12 }],
  assets: [{ file: 'shot.png', label: 'Shot', mime: 'image/png', kind: 'image', bytes: 2048 }],
  legacyReport: true,
}

const DOC = { file: 'run-log.md', label: 'Run log', medium: 'markdown', body: 'log' }
const ASSET = { file: 'shot.png', label: 'Shot', mime: 'image/png', kind: 'image', bytes: 2048 }
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
    readEvidenceSummary: async (input) => {
      calls.push(['readEvidenceSummary', input])
      return PACK
    },
    readEvidenceResults: async (input) => {
      calls.push(['readEvidenceResults', input])
      return [DOC] as never
    },
    listEvidenceAssets: async (input) => {
      calls.push(['listEvidenceAssets', input])
      return [ASSET] as never
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
  it('serializes the document set, the gallery, one asset body, and a void clear from one operation each', async () => {
    const calls: unknown[] = []
    const caller = createReviewEvidenceRouter(evidenceOps({}, calls)).createCaller(PUBLIC_CONTEXT)

    expect(await caller.reviewEvidenceDocs(REPO)).toEqual([DOC])
    expect(await caller.reviewEvidenceAssets(REPO)).toEqual([ASSET])
    expect(await caller.reviewEvidenceAsset({ repoPath: REPO, file: 'shot.png' })).toEqual(BODY)
    expect(await caller.clearLoopEvidence(REPO)).toBeUndefined()

    expect(calls).toEqual([
      ['readEvidenceResults', { projectPath: REPO }],
      ['listEvidenceAssets', { projectPath: REPO }],
      ['readEvidenceAsset', { projectPath: REPO, file: 'shot.png' }],
      ['clearEvidence', { projectPath: REPO }],
    ])
  })

  it('projects loopEvidence to counts and the legacy marker, and emits no dir', async () => {
    const calls: unknown[] = []
    const caller = createReviewEvidenceRouter(evidenceOps({}, calls)).createCaller(PUBLIC_CONTEXT)

    const meta = await caller.loopEvidence(REPO)

    expect(meta).toEqual({
      title: 'Evidence',
      updatedAt: '2026-08-11T00:00:00.000Z',
      checks: [{ label: 'pnpm lint', status: 'pass' }],
      medium: 'html',
      results: 1,
      assets: 1,
      hasReport: true,
    })
    expect(meta).not.toHaveProperty('dir')
    expect(calls).toEqual([['readEvidenceSummary', { projectPath: REPO }]])
  })

  it('serializes an absent pack and a missing asset as null', async () => {
    const caller = createReviewEvidenceRouter(
      evidenceOps({
        readEvidenceSummary: async () => null,
        readEvidenceAsset: async () => null,
      }),
    ).createCaller(PUBLIC_CONTEXT)

    expect(await caller.loopEvidence(REPO)).toBeNull()
    expect(await caller.reviewEvidenceAsset({ repoPath: REPO, file: 'gone.png' })).toBeNull()
  })

  it('rejects an empty evidence asset name before any operation runs', async () => {
    const calls: unknown[] = []
    const router = createReviewEvidenceRouter(evidenceOps({}, calls))

    expectPublicCode(
      await rejected(() =>
        callTRPCProcedure({
          router,
          path: 'reviewEvidenceAsset',
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
    expect(calls).toEqual([])
  })

  it('refuses to serialize a check status that violates the contract', async () => {
    const caller = createReviewEvidenceRouter(
      evidenceOps({
        readEvidenceSummary: async () =>
          ({ ...PACK, checks: [{ label: 'pnpm verify', status: 'exploded' }] }) as never,
      }),
    ).createCaller(PUBLIC_CONTEXT)

    expectPublicCode(await rejected(() => caller.loopEvidence(REPO)), 'internal.unexpected', true)
  })

  it('surfaces a thrown operation failure as internal.unexpected, unchanged from the legacy router', async () => {
    const caller = createReviewEvidenceRouter(
      evidenceOps({
        readEvidenceResults: async () => {
          throw new Error('disk exploded')
        },
      }),
    ).createCaller(PUBLIC_CONTEXT)

    expectPublicCode(
      await rejected(() => caller.reviewEvidenceDocs(REPO)),
      'internal.unexpected',
      true,
    )
  })
})
