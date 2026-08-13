// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'

// This suite owns the tRPC contract seam only: which raw wire input the Review router
// accepts and which resolver result it will serialize. Every companion read/write —
// review sets, the legacy evidence body, comments (via construction-seam ops), the Git
// plumbing behind the readings — is mocked with synthetic data, so nothing here touches
// a real repository or channel. Lifecycle and Evidence procedures live in the Review
// feature's own router seams (`features/review/review-lifecycle-router.test.ts`,
// `features/review/review-evidence-router.test.ts`).
const { git, docSet, commentOps, evidence, reviewed } = vi.hoisted(() => {
  return {
    git: {
      reviewedFingerprint: vi.fn(async () => 'fp-alpha'),
      reviewedFingerprints: vi.fn(async () => new Map([['src/alpha.ts', 'fp-alpha']])),
    },
    docSet: {
      readActiveIntentDocs: vi.fn(async () => [
        { file: 'intent.md', label: 'Intent', medium: 'markdown', body: '# Intent' },
      ]),
    },
    commentOps: {
      listReviewComments: vi.fn(async () => ({
        ok: true as const,
        value: [
          {
            id: 'c1',
            path: 'src/alpha.ts',
            startLine: 1,
            endLine: 2,
            body: 'Check this invariant',
            resolved: false,
            createdAt: 1_760_000_000_000,
          },
        ],
      })),
      addReviewComment: vi.fn(async () => ({
        ok: true as const,
        value: {
          id: 'c2',
          path: 'src/alpha.ts',
          body: 'Check this invariant',
          resolved: false,
          createdAt: 1_760_000_000_001,
        },
      })),
      editReviewComment: vi.fn(async () => ({ ok: true as const, value: undefined })),
      deleteReviewComment: vi.fn(async () => ({ ok: true as const, value: undefined })),
      resolveReviewComment: vi.fn(async () => ({ ok: true as const, value: undefined })),
      clearResolvedReviewComments: vi.fn(async () => ({ ok: true as const, value: undefined })),
    },
    evidence: {
      readEvidence: vi.fn(async () => ({
        title: 'Evidence',
        updatedAt: '2026-08-10T00:00:00.000Z',
        dir: '/synthetic/repo/.porcelain/active-review/evidence',
        checks: [{ label: 'pnpm verify', status: 'pass' }],
        medium: 'html',
        html: '<p>green</p>',
      })),
    },
    reviewed: {
      markReviewed: vi.fn(async () => undefined),
      unmarkReviewed: vi.fn(async () => undefined),
      readReviewedMarks: vi.fn(async () => [{ path: 'src/alpha.ts', fingerprint: 'fp-alpha' }]),
      reconcileReviewed: vi.fn(async () => ['src/alpha.ts']),
      setReviewedMarks: vi.fn(async () => undefined),
    },
  }
})

vi.mock('../git/git', () => git)
vi.mock('../review/doc-set', () => docSet)
vi.mock('../stores/evidence-store', () => evidence)
vi.mock('../stores/reviewed-store', () => reviewed)

import { createReviewCommentRouter } from '../features/review'
import { t } from '../trpc'
import { createReviewRouter } from './review'

const reviewRouter = t.mergeRouters(createReviewRouter(), createReviewCommentRouter(commentOps))

const REQUEST_ID = '00000000-0000-4000-8000-000000000117'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' }, requestId: REQUEST_ID } as const
const REPO = '/synthetic/repo'

function caller() {
  return reviewRouter.createCaller(PUBLIC_CONTEXT)
}

/** Deliver raw untrusted input the typed caller cannot express — the wire's own entry point. */
async function callWithRawInput(path: string, type: 'query' | 'mutation', input: unknown) {
  return await callTRPCProcedure({
    router: reviewRouter,
    path,
    type,
    ctx: PUBLIC_CONTEXT,
    getRawInput: async () => input,
    signal: undefined,
    batchIndex: 0,
  })
}

async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('Expected a tRPC rejection')
}

function expectPublicCode(error: unknown, code: string, unexpected: boolean) {
  const normalized = normalizePublicError(error, REQUEST_ID)
  expect(normalized.unexpected).toBe(unexpected)
  expect(publicErrorSchema.parse(normalized.error)).toMatchObject({ code, requestId: REQUEST_ID })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('review router contract input', () => {
  it('rejects an unknown key on a reviewed mark without touching the store', async () => {
    const error = await rejected(() =>
      callWithRawInput('markReviewed', 'mutation', {
        repoPath: REPO,
        path: 'src/alpha.ts',
        force: true,
      }),
    )

    expectPublicCode(error, 'request.invalid', false)
    expect(reviewed.markReviewed).not.toHaveBeenCalled()
  })

  it('rejects an unknown key on a comment mutation without writing a comment', async () => {
    const error = await rejected(() =>
      callWithRawInput('addReviewComment', 'mutation', {
        repoPath: REPO,
        path: 'src/alpha.ts',
        body: 'Check this invariant',
        severity: 'blocker',
      }),
    )

    expectPublicCode(error, 'request.invalid', false)
    expect(commentOps.addReviewComment).not.toHaveBeenCalled()
  })

  it('keeps the comment body minimums', async () => {
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('addReviewComment', 'mutation', {
          repoPath: REPO,
          path: 'src/alpha.ts',
          body: '',
        }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('editReviewComment', 'mutation', { repoPath: REPO, id: 'c1', body: '' }),
      ),
      'request.invalid',
      false,
    )
    expect(commentOps.addReviewComment).not.toHaveBeenCalled()
    expect(commentOps.editReviewComment).not.toHaveBeenCalled()
  })
})

describe('review router contract output', () => {
  it('serializes reconciled reviewed paths', async () => {
    expect(await caller().reviewedPaths(REPO)).toEqual(['src/alpha.ts'])
    expect(reviewed.reconcileReviewed).toHaveBeenCalledWith(
      REPO,
      [{ path: 'src/alpha.ts', fingerprint: 'fp-alpha' }],
      new Map([['src/alpha.ts', 'fp-alpha']]),
    )
  })

  it('serializes the Intent document set', async () => {
    expect(await caller().reviewIntent(REPO)).toEqual([
      { file: 'intent.md', label: 'Intent', medium: 'markdown', body: '# Intent' },
    ])
  })

  it('serializes both loop-evidence body members', async () => {
    expect(await caller().loopEvidenceHtml(REPO)).toMatchObject({ html: '<p>green</p>' })

    evidence.readEvidence.mockResolvedValueOnce({
      title: 'Evidence',
      updatedAt: '2026-08-10T00:00:00.000Z',
      dir: '/synthetic/repo/.porcelain/active-review/evidence',
      checks: [],
      medium: 'html',
      htmlUnavailable: { reason: 'too-large', bytes: 5_000_000, maxBytes: 4_194_304 },
    } as never)

    expect(await caller().loopEvidenceHtml(REPO)).toMatchObject({
      htmlUnavailable: { reason: 'too-large', bytes: 5_000_000, maxBytes: 4_194_304 },
    })
  })

  it('serializes comment reads and the created comment', async () => {
    expect(await caller().reviewComments(REPO)).toEqual([
      {
        id: 'c1',
        path: 'src/alpha.ts',
        startLine: 1,
        endLine: 2,
        body: 'Check this invariant',
        resolved: false,
        createdAt: 1_760_000_000_000,
      },
    ])
    expect(
      await caller().addReviewComment({
        repoPath: REPO,
        path: 'src/alpha.ts',
        body: 'Check this invariant',
      }),
    ).toMatchObject({ id: 'c2', resolved: false })
    expect(commentOps.addReviewComment).toHaveBeenCalledWith({
      projectPath: REPO,
      path: 'src/alpha.ts',
      body: 'Check this invariant',
      startLine: undefined,
      endLine: undefined,
      anchorText: undefined,
    })
  })

  it('serializes void Review mutations as undefined', async () => {
    expect(await caller().markReviewed({ repoPath: REPO, path: 'src/alpha.ts' })).toBeUndefined()
    expect(await caller().unmarkReviewed({ repoPath: REPO, path: 'src/alpha.ts' })).toBeUndefined()
    expect(await caller().setReviewed({ repoPath: REPO, paths: ['src/alpha.ts'] })).toBeUndefined()
    expect(
      await caller().resolveReviewComment({ repoPath: REPO, id: 'c1', resolved: true }),
    ).toBeUndefined()
    expect(await caller().clearResolvedReviewComments({ repoPath: REPO })).toBeUndefined()
    expect(reviewed.markReviewed).toHaveBeenCalledWith(REPO, 'src/alpha.ts', 'fp-alpha')
    expect(commentOps.resolveReviewComment).toHaveBeenCalledWith({
      projectPath: REPO,
      commentId: 'c1',
      resolved: true,
    })
  })

  it('refuses to serialize a comment with an unknown key', async () => {
    commentOps.listReviewComments.mockResolvedValueOnce({
      ok: true,
      value: [
        {
          id: 'c1',
          path: 'src/alpha.ts',
          body: 'Check this invariant',
          resolved: false,
          createdAt: 1_760_000_000_000,
          severity: 'blocker',
        },
      ],
    } as never)

    expectPublicCode(
      await rejected(() => caller().reviewComments(REPO)),
      'internal.unexpected',
      true,
    )
  })
})
