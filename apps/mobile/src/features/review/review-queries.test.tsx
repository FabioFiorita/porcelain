import {
  reviewArchivedQuery,
  reviewEvidenceAssetQuery,
  reviewEvidenceDocQuery,
  reviewEvidenceQuery,
  reviewIntentQuery,
  reviewPublishCostQuery,
  reviewReadingQuery,
} from '@porcelain/client-runtime/review'
import {
  createValidatingDaemonMock,
  type DaemonMockOutcome,
  type ValidatingDaemonMock,
} from '@porcelain/client-runtime/testing/daemon-mock'
import { procedureCatalog, publicErrorSchema } from '@porcelain/contracts'
import { reviewContractFixtures } from '@porcelain/contracts/review'
import { sessionChangeSchema } from '@porcelain/contracts/session'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { TRPCClientError } from '@trpc/client'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const REPO = reviewContractFixtures.reviewReading.input
const RESULT_DOC = reviewContractFixtures.reviewEvidenceDoc.input.file
const OTHER_REPO = '/synthetic/other'
const ENV_ID = 'env-review-reads'

type TestDaemonClient = {
  query: (procedure: string, input: unknown) => Promise<unknown>
  mutation: (procedure: string, input: unknown) => Promise<unknown>
}

type TestPairedEnvironment = {
  id: string
  nickname: string
  icon: 'desktop'
  baseUrl: string
  endpoints: string[]
  preferredEndpoint: string
  createdAt: number
  activeRepoPath: string | null
  token: string | null
}

const PAIRED_ENV: TestPairedEnvironment = {
  id: ENV_ID,
  nickname: 'test',
  icon: 'desktop',
  baseUrl: 'http://127.0.0.1:43118',
  endpoints: ['http://127.0.0.1:43118'],
  preferredEndpoint: 'http://127.0.0.1:43118',
  createdAt: 1,
  activeRepoPath: REPO,
  token: 'pc_client_test',
}

const ctx = vi.hoisted(() => ({
  client: null as TestDaemonClient | null,
  env: null as TestPairedEnvironment | null,
  repoPath: null as string | null,
}))

vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: (): TestDaemonClient => {
    if (ctx.client === null) throw new Error('test client not installed')
    return ctx.client
  },
}))

vi.mock('@/features/projects', () => ({
  useActiveProject: () => (ctx.repoPath === null ? null : { path: ctx.repoPath, name: 'repo' }),
}))

vi.mock('@/features/remote', () => ({
  // Pure identity the subject reads from the same feature index; the store half is faked below.
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useActiveEnvironment: () => ctx.env,
  environmentActions: {
    recordReachabilitySuccess: vi.fn(),
    recordReachabilityFailure: vi.fn(),
  },
}))

import { parseReviewQueryKey, reviewQueryKey } from './review-query-key'
import {
  useArchivedReviews,
  useReviewEvidence,
  useReviewEvidenceAsset,
  useReviewEvidenceDoc,
  useReviewIntentDocs,
  useReviewPublishCost,
  useReviewReading,
} from './use-review'
import { REVIEW_DISABLED_PROJECT } from './use-review-transport'

const validatingCatalog = {
  procedures: procedureCatalog,
  notification: sessionChangeSchema,
  publicError: publicErrorSchema,
} as const

type Handlers = Readonly<
  Record<string, (input: unknown) => DaemonMockOutcome | Promise<DaemonMockOutcome>>
>

function clientFromMock(mock: ValidatingDaemonMock): TestDaemonClient {
  const dispatch = async (
    kind: 'query' | 'mutation',
    procedure: string,
    input: unknown,
  ): Promise<unknown> => {
    const outcome = await mock.dispatch({ procedure, kind, input })
    if (!outcome.ok) {
      throw TRPCClientError.from(
        Object.assign(new Error('Daemon mock public error'), {
          data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500, porcelain: outcome.error },
        }),
      )
    }
    return outcome.value
  }
  return {
    query: (procedure, input) => dispatch('query', procedure, input),
    mutation: (procedure, input) => dispatch('mutation', procedure, input),
  }
}

/** Contract-shaped outcomes for the seven Review reads this client makes. */
function defaultHandlers(overrides: Handlers = {}): Handlers {
  return {
    reviewReading: () => ({ ok: true, value: reviewContractFixtures.reviewReading.output }),
    reviewIntent: () => ({ ok: true, value: reviewContractFixtures.reviewIntent.output }),
    reviewEvidence: () => ({ ok: true, value: reviewContractFixtures.reviewEvidence.output }),
    reviewEvidenceDoc: () => ({
      ok: true,
      value: reviewContractFixtures.reviewEvidenceDoc.output,
    }),
    reviewEvidenceAsset: () => ({
      ok: true,
      value: reviewContractFixtures.reviewEvidenceAsset.output,
    }),
    publishCost: () => ({ ok: true, value: reviewContractFixtures.publishCost.output }),
    archivedReviews: () => ({ ok: true, value: reviewContractFixtures.archivedReviews.output }),
    ...overrides,
  }
}

function harness(handlers: Handlers = {}): {
  mock: ValidatingDaemonMock
  queryClient: QueryClient
  wrapper: (props: { children: ReactNode }) => React.JSX.Element
} {
  const mock = createValidatingDaemonMock(validatingCatalog, defaultHandlers(handlers))
  ctx.client = clientFromMock(mock)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { mock, queryClient, wrapper }
}

/** Every read, mounted together the way the Review canvas mounts them. */
function useAllReads(enabled: boolean, file = 'shot.png') {
  return {
    archived: useArchivedReviews(enabled),
    asset: useReviewEvidenceAsset(file, enabled),
    cost: useReviewPublishCost(enabled),
    doc: useReviewEvidenceDoc(RESULT_DOC, enabled),
    evidence: useReviewEvidence(enabled),
    intent: useReviewIntentDocs(enabled),
    reading: useReviewReading(enabled),
  }
}

function procedureNames(mock: ValidatingDaemonMock): string[] {
  return mock.requests().map((request) => request.procedure)
}

beforeEach(() => {
  ctx.env = PAIRED_ENV
  ctx.repoPath = REPO
  ctx.client = null
})

describe('Mobile Review reads', () => {
  it('calls each live procedure once and caches it under its Review identity', async () => {
    const { mock, queryClient, wrapper } = harness()

    const { result } = renderHook(() => useAllReads(true), { wrapper })

    await waitFor(() => expect(result.current.reading.reading).not.toBeUndefined())
    await waitFor(() => expect(result.current.archived).toHaveLength(1))
    await waitFor(() => expect(result.current.asset.asset).not.toBeUndefined())
    await waitFor(() => expect(result.current.cost).not.toBeUndefined())
    await waitFor(() => expect(result.current.doc.doc).not.toBeUndefined())
    await waitFor(() => expect(result.current.intent.docs).not.toBeUndefined())
    await waitFor(() => expect(result.current.evidence.evidence).not.toBeUndefined())

    expect(procedureNames(mock).toSorted()).toEqual([
      'archivedReviews',
      'publishCost',
      'reviewEvidence',
      'reviewEvidenceAsset',
      'reviewEvidenceDoc',
      'reviewIntent',
      'reviewReading',
    ])

    for (const query of [
      reviewReadingQuery(REPO),
      reviewIntentQuery(REPO),
      reviewEvidenceQuery(REPO),
      reviewEvidenceDocQuery(REPO, RESULT_DOC),
      reviewEvidenceAssetQuery(REPO, 'shot.png'),
      reviewPublishCostQuery(REPO),
      reviewArchivedQuery(REPO),
    ]) {
      expect(queryClient.getQueryData(reviewQueryKey(ENV_ID, query))).not.toBeUndefined()
    }
  })

  it('never shares a cache entry between two projects or two asset files', async () => {
    const { queryClient, wrapper } = harness()

    const first = renderHook(() => useReviewEvidenceAsset('shot.png', true), { wrapper })
    await waitFor(() => expect(first.result.current.asset).not.toBeUndefined())
    const second = renderHook(() => useReviewEvidenceAsset('trace.png', true), { wrapper })
    await waitFor(() => expect(second.result.current.asset).not.toBeUndefined())

    ctx.repoPath = OTHER_REPO
    const other = renderHook(() => useReviewReading(true), { wrapper })
    await waitFor(() => expect(other.result.current.reading).not.toBeUndefined())

    expect(
      queryClient.getQueryData(reviewQueryKey(ENV_ID, reviewEvidenceAssetQuery(REPO, 'shot.png'))),
    ).not.toBeUndefined()
    expect(
      queryClient.getQueryData(reviewQueryKey(ENV_ID, reviewEvidenceAssetQuery(REPO, 'trace.png'))),
    ).not.toBeUndefined()
    expect(
      queryClient.getQueryData(reviewQueryKey(ENV_ID, reviewReadingQuery(OTHER_REPO))),
    ).not.toBeUndefined()
    expect(
      queryClient.getQueryData(reviewQueryKey(ENV_ID, reviewReadingQuery(REPO))),
    ).toBeUndefined()
  })

  it('issues nothing with no project, no paired daemon, or a closed gate', async () => {
    const closed = harness()
    renderHook(() => useAllReads(false), { wrapper: closed.wrapper })
    await Promise.resolve()
    expect(procedureNames(closed.mock)).toEqual([])

    ctx.repoPath = null
    const noProject = harness()
    renderHook(() => useAllReads(true), { wrapper: noProject.wrapper })
    await Promise.resolve()
    expect(procedureNames(noProject.mock)).toEqual([])
    // A disabled read still carries a well-formed identity rather than an empty path.
    for (const query of noProject.queryClient.getQueryCache().getAll()) {
      const parsed = parseReviewQueryKey(query.queryKey)
      expect(parsed?.query.projectPath).toBe(REVIEW_DISABLED_PROJECT)
    }

    ctx.repoPath = REPO
    ctx.env = { ...PAIRED_ENV, token: null }
    const unpaired = harness()
    renderHook(() => useAllReads(true), { wrapper: unpaired.wrapper })
    await Promise.resolve()
    expect(procedureNames(unpaired.mock)).toEqual([])
  })

  it('reads one asset once its gate opens, and shows null as the over-cap case', async () => {
    const { mock, wrapper } = harness({
      // The daemon answers `null` for media past its per-asset cap.
      reviewEvidenceAsset: () => ({ ok: true, value: null }),
    })

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useReviewEvidenceAsset('shot.png', enabled),
      { initialProps: { enabled: false }, wrapper },
    )
    expect(procedureNames(mock)).toEqual([])

    rerender({ enabled: true })
    await waitFor(() => expect(result.current.asset).toBeNull())
    expect(procedureNames(mock)).toEqual(['reviewEvidenceAsset'])
  })
})

describe('Mobile Review contract strictness (REV-008 ruling 7)', () => {
  /**
   * A daemon older than the HTML + Markdown collapse, answering shapes the contract does not
   * describe. The validating mock cannot serve these — that is the point: they are exactly
   * what the client must refuse. So the transport hands them over raw.
   */
  function rawClient(payloads: Readonly<Record<string, unknown>>): TestDaemonClient {
    return {
      query: (procedure: string): Promise<unknown> => Promise.resolve(payloads[procedure]),
      mutation: (): Promise<unknown> => Promise.resolve(undefined),
    }
  }

  function rawWrapper(): (props: { children: ReactNode }) => React.JSX.Element {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return ({ children }: { children: ReactNode }): React.JSX.Element => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  it('fails an unknown-medium document read instead of silently dropping the document', async () => {
    ctx.client = rawClient({
      reviewIntent: [
        { file: 'intent.txt', label: 'Intent', medium: 'plaintext', body: 'legacy medium' },
      ],
    })

    const { result } = renderHook(() => useReviewIntentDocs(true), { wrapper: rawWrapper() })

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.docs).toBeUndefined()
  })

  it('fails a reading carrying a field this build has no model for', async () => {
    ctx.client = rawClient({
      reviewReading: {
        ...reviewContractFixtures.reviewReading.output,
        canvas: { medium: 'scene', scene: 'legacy' },
      },
    })

    const { result } = renderHook(() => useReviewReading(true), { wrapper: rawWrapper() })

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.reading).toBeUndefined()
  })
})
