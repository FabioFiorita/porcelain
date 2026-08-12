// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'

// This suite owns the tRPC contract seam only: which raw wire input the Review router
// accepts and which resolver result it will serialize. Every companion read/write —
// review sets, evidence packs, comments (via construction-seam ops), archives, the Git
// plumbing behind the readings — is mocked with synthetic data, so nothing here touches
// a real repository or channel.
const {
  git,
  docSet,
  assets,
  featureBuild,
  explore,
  commentOps,
  evidence,
  layers,
  reviews,
  reviewed,
} = vi.hoisted(() => {
  const view = {
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
            connects: [],
          },
        ],
      },
    ],
  }
  return {
    git: {
      reviewedFingerprint: vi.fn(async () => 'fp-alpha'),
      reviewedFingerprints: vi.fn(async () => new Map([['src/alpha.ts', 'fp-alpha']])),
      gitDiffFile: vi.fn(async () => ({ hunks: [], status: 'modified' })),
      gitListFiles: vi.fn(async () => ['src/alpha.ts']),
    },
    docSet: {
      readActiveIntentDocs: vi.fn(async () => [
        { file: 'intent.md', label: 'Intent', medium: 'markdown', body: '# Intent' },
      ]),
      readActiveEvidenceResults: vi.fn(async () => [
        { file: 'index.html', label: 'Results', medium: 'html', body: '<p>green</p>' },
      ]),
    },
    assets: {
      listEvidenceAssets: vi.fn(async () => [
        { file: 'shot.png', label: 'shot', kind: 'image', mime: 'image/png', bytes: 2048 },
      ]),
      readEvidenceAsset: vi.fn(async () => ({
        file: 'shot.png',
        mime: 'image/png',
        bytes: 2048,
        dataUrl: 'data:image/png;base64,AAAA',
      })),
    },
    featureBuild: {
      gatherFeature: vi.fn(async () => ({
        files: [],
        stats: [],
        layers: [],
        reviewSet: null as unknown,
        key: 'key-1',
      })),
      getFeatureBuild: vi.fn(async () => ({ key: 'key-1', view, sources: new Map() })),
      cachedFeatureReading: vi.fn(() => null),
      storeFeatureReading: vi.fn(() => undefined),
    },
    explore: {
      walkExplore: vi.fn(async () => []),
      buildExploreReading: vi.fn(() => ({
        name: 'alpha.ts',
        sections: [],
        groups: [],
        evidence: null,
      })),
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
      readEvidenceMeta: vi.fn(async () => ({
        title: 'Evidence',
        updatedAt: '2026-08-10T00:00:00.000Z',
        checks: [{ label: 'pnpm verify', status: 'pass' }],
        dir: '/synthetic/repo/.porcelain/active-review/evidence',
        medium: 'html',
        results: 1,
        assets: 1,
        hasReport: true,
      })),
      readEvidence: vi.fn(async () => ({
        title: 'Evidence',
        updatedAt: '2026-08-10T00:00:00.000Z',
        dir: '/synthetic/repo/.porcelain/active-review/evidence',
        checks: [{ label: 'pnpm verify', status: 'pass' }],
        medium: 'html',
        html: '<p>green</p>',
      })),
      clearEvidence: vi.fn(async () => undefined),
    },
    layers: { readLayers: vi.fn(async () => null) },
    reviews: {
      activeReviewCost: vi.fn(async () => ({ bytes: 2048, files: 3 })),
      publishActiveReview: vi.fn(async () => ({
        id: '2026-08-10-review',
        cost: { bytes: 2048, files: 3 },
      })),
      listArchivedReviews: vi.fn(async () => [
        {
          id: '2026-08-09-review',
          name: 'Earlier review',
          thesis: 'It shipped',
          archivedAt: '2026-08-09T00:00:00.000Z',
        },
      ]),
      restoreArchivedReview: vi.fn(async () => undefined),
      deleteArchivedReview: vi.fn(async () => undefined),
      clearReviewSet: vi.fn(async () => undefined),
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
vi.mock('../review/evidence-assets-list', () => assets)
vi.mock('../review/feature-build', () => featureBuild)
vi.mock('../review/feature-explore', () => explore)
vi.mock('../stores/evidence-store', () => evidence)
vi.mock('../features/project-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/project-data')>()
  return { ...actual, readLayers: layers.readLayers }
})
vi.mock('../stores/review-store', () => reviews)
vi.mock('../stores/reviewed-store', () => reviewed)

import { createReviewCommentRouter } from '../features/review'
import { t } from '../trpc'
import { createReviewRouter } from './review'

const reviewRouter = t.mergeRouters(createReviewRouter(), createReviewCommentRouter(commentOps))

const REQUEST_ID = '00000000-0000-4000-8000-000000000117'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' }, requestId: REQUEST_ID } as const
const REPO = '/synthetic/repo'

const REVIEW_SET = {
  name: 'Review',
  files: [{ path: 'src/alpha.ts', source: 'changed' }],
  sections: [],
}

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

  it('keeps the comment body and archive id minimums', async () => {
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
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('restoreArchivedReview', 'mutation', { repoPath: REPO, id: '' }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('deleteArchivedReview', 'mutation', { repoPath: REPO, id: '' }),
      ),
      'request.invalid',
      false,
    )
    expect(commentOps.addReviewComment).not.toHaveBeenCalled()
    expect(commentOps.editReviewComment).not.toHaveBeenCalled()
    expect(reviews.restoreArchivedReview).not.toHaveBeenCalled()
    expect(reviews.deleteArchivedReview).not.toHaveBeenCalled()
  })

  it('rejects an empty evidence asset name before any file read', async () => {
    const error = await rejected(() =>
      callWithRawInput('reviewEvidenceAsset', 'query', { repoPath: REPO, file: '' }),
    )

    expectPublicCode(error, 'request.invalid', false)
    expect(assets.readEvidenceAsset).not.toHaveBeenCalled()
  })

  it('rejects an exploration seed missing its symbol without walking the graph', async () => {
    const error = await rejected(() =>
      callWithRawInput('exploreFeature', 'query', {
        repoPath: REPO,
        seed: { kind: 'symbol', path: 'src/alpha.ts' },
      }),
    )

    expectPublicCode(error, 'request.invalid', false)
    expect(explore.walkExplore).not.toHaveBeenCalled()
  })

  it('rejects an object where a bare repo-path query is contracted', async () => {
    const error = await rejected(() => callWithRawInput('featureView', 'query', { repoPath: REPO }))

    expectPublicCode(error, 'request.invalid', false)
    expect(featureBuild.gatherFeature).not.toHaveBeenCalled()
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

  it('serializes the Review view and reading as null without an agent review set', async () => {
    expect(await caller().featureView(REPO)).toBeNull()
    expect(await caller().featureReading(REPO)).toBeNull()
    expect(featureBuild.getFeatureBuild).not.toHaveBeenCalled()
  })

  it('serializes the Review view and reading built from an agent review set', async () => {
    featureBuild.gatherFeature.mockResolvedValue({
      files: [],
      stats: [],
      layers: [],
      reviewSet: REVIEW_SET,
      key: 'key-1',
    })

    expect(await caller().featureView(REPO)).toMatchObject({ name: 'Review', fromAgent: true })

    const reading = await caller().featureReading(REPO)
    expect(reading).toMatchObject({
      name: 'Review',
      sections: [],
      evidence: {
        title: 'Evidence',
        updatedAt: '2026-08-10T00:00:00.000Z',
        checks: [{ label: 'pnpm verify', status: 'pass' }],
        medium: 'html',
      },
    })
    expect(featureBuild.storeFeatureReading).toHaveBeenCalled()

    featureBuild.gatherFeature.mockResolvedValue({
      files: [],
      stats: [],
      layers: [],
      reviewSet: null,
      key: 'key-1',
    })
  })

  it('serializes Intent and Evidence document sets and the asset gallery', async () => {
    expect(await caller().reviewIntent(REPO)).toEqual([
      { file: 'intent.md', label: 'Intent', medium: 'markdown', body: '# Intent' },
    ])
    expect(await caller().reviewEvidenceDocs(REPO)).toEqual([
      { file: 'index.html', label: 'Results', medium: 'html', body: '<p>green</p>' },
    ])
    expect(await caller().reviewEvidenceAssets(REPO)).toEqual([
      { file: 'shot.png', label: 'shot', kind: 'image', mime: 'image/png', bytes: 2048 },
    ])
    expect(await caller().reviewEvidenceAsset({ repoPath: REPO, file: 'shot.png' })).toEqual({
      file: 'shot.png',
      mime: 'image/png',
      bytes: 2048,
      dataUrl: 'data:image/png;base64,AAAA',
    })
  })

  it('serializes a missing evidence asset as null', async () => {
    assets.readEvidenceAsset.mockResolvedValueOnce(null as never)

    expect(await caller().reviewEvidenceAsset({ repoPath: REPO, file: 'gone.png' })).toBeNull()
  })

  it('serializes publish cost, publish result, and the archive list', async () => {
    expect(await caller().reviewPublishCost(REPO)).toEqual({ bytes: 2048, files: 3 })
    expect(await caller().publishReview(REPO)).toEqual({
      id: '2026-08-10-review',
      cost: { bytes: 2048, files: 3 },
    })
    expect(await caller().archivedReviews(REPO)).toEqual([
      {
        id: '2026-08-09-review',
        name: 'Earlier review',
        thesis: 'It shipped',
        archivedAt: '2026-08-09T00:00:00.000Z',
      },
    ])
  })

  it('serializes nothing to publish as null', async () => {
    reviews.publishActiveReview.mockResolvedValueOnce(null as never)

    expect(await caller().publishReview(REPO)).toBeNull()
  })

  it('serializes both loop-evidence body members and the metadata read', async () => {
    expect(await caller().loopEvidence(REPO)).toMatchObject({ title: 'Evidence', medium: 'html' })
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

  it('serializes the exploration reading', async () => {
    expect(
      await caller().exploreFeature({
        repoPath: REPO,
        seed: { kind: 'file', path: 'src/alpha.ts' },
      }),
    ).toEqual({
      name: 'alpha.ts',
      sections: [],
      groups: [],
      evidence: null,
    })
  })

  it('serializes void Review mutations as undefined', async () => {
    expect(await caller().markReviewed({ repoPath: REPO, path: 'src/alpha.ts' })).toBeUndefined()
    expect(await caller().unmarkReviewed({ repoPath: REPO, path: 'src/alpha.ts' })).toBeUndefined()
    expect(await caller().setReviewed({ repoPath: REPO, paths: ['src/alpha.ts'] })).toBeUndefined()
    expect(await caller().clearFeatureReview(REPO)).toBeUndefined()
    expect(await caller().clearLoopEvidence(REPO)).toBeUndefined()
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

  it('refuses to serialize an archived review row with an unknown key', async () => {
    reviews.listArchivedReviews.mockResolvedValueOnce([
      {
        id: '2026-08-09-review',
        name: 'Earlier review',
        archivedAt: '2026-08-09T00:00:00.000Z',
        stale: true,
      },
    ] as never)

    expectPublicCode(
      await rejected(() => caller().archivedReviews(REPO)),
      'internal.unexpected',
      true,
    )
  })

  it('refuses to serialize evidence metadata whose check status violates the contract', async () => {
    evidence.readEvidenceMeta.mockResolvedValueOnce({
      title: 'Evidence',
      updatedAt: '2026-08-10T00:00:00.000Z',
      checks: [{ label: 'pnpm verify', status: 'exploded' }],
      medium: 'html',
    } as never)

    expectPublicCode(await rejected(() => caller().loopEvidence(REPO)), 'internal.unexpected', true)
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
