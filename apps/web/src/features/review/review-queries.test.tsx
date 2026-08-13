import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { reviewContractFixtures } from '@porcelain/contracts/review'
import {
  createValidatingTrpcHarness,
  type DaemonMockHandlers,
} from '@renderer/hooks/trpc-test-harness'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  useActiveReview,
  useArchivedReviews,
  useEvidenceAsset,
  useEvidenceDoc,
  useExplore,
  useReviewEvidence,
  useReviewIntent,
  useReviewPublishCost,
  useReviewReading,
} from './review-queries'

const F = reviewContractFixtures
const PROJECT = F.activeReview.input
const OTHER = '/synthetic/other'

function handlers(overrides: DaemonMockHandlers = {}): DaemonMockHandlers {
  return {
    daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
    activeReview: () => ({ ok: true, value: F.activeReview.output }),
    reviewReading: () => ({ ok: true, value: F.reviewReading.output }),
    reviewIntent: () => ({ ok: true, value: F.reviewIntent.output }),
    publishCost: () => ({ ok: true, value: F.publishCost.output }),
    reviewEvidence: () => ({ ok: true, value: F.reviewEvidence.output }),
    reviewEvidenceDoc: () => ({ ok: true, value: F.reviewEvidenceDoc.output }),
    reviewEvidenceAsset: () => ({ ok: true, value: F.reviewEvidenceAsset.output }),
    archivedReviews: () => ({ ok: true, value: F.archivedReviews.output }),
    exploreReading: () => ({ ok: true, value: F.exploreReading.output }),
    ...overrides,
  }
}

function selectProject(path: string | null): void {
  useProjectSelectionStore.setState({ project: path === null ? null : { name: 'repo', path } })
}

const assetFile = F.reviewEvidenceAsset.input.file
const docFile = F.reviewEvidenceDoc.input.file
const seed = { kind: 'file' as const, path: 'src/changed.ts' }

/** The nine reads, each with the canonical procedure it must reach exactly once. */
const reads = [
  ['useActiveReview', 'activeReview', () => useActiveReview()],
  ['useReviewReading', 'reviewReading', () => useReviewReading()],
  ['useReviewIntent', 'reviewIntent', () => useReviewIntent()],
  ['useReviewPublishCost', 'publishCost', () => useReviewPublishCost(true)],
  ['useReviewEvidence', 'reviewEvidence', () => useReviewEvidence()],
  ['useEvidenceDoc', 'reviewEvidenceDoc', () => useEvidenceDoc(docFile, true)],
  ['useEvidenceAsset', 'reviewEvidenceAsset', () => useEvidenceAsset(assetFile, true)],
  ['useArchivedReviews', 'archivedReviews', () => useArchivedReviews()],
  ['useExplore', 'exploreReading', () => useExplore(seed.path)],
] as const

describe('Review read adapter', () => {
  beforeEach(() => {
    selectProject(PROJECT)
  })

  it('reads each of the nine canonical procedures through the validating daemon mock', async () => {
    expect(reads).toHaveLength(9)
    for (const [, procedure, hook] of reads) {
      const { mock, wrapper } = createValidatingTrpcHarness(handlers())
      renderHook(hook, { wrapper })
      await waitFor(() =>
        expect(mock.requests().filter((r) => r.procedure === procedure)).toHaveLength(1),
      )
    }
  })

  it('issues no request for any read while no project is selected', async () => {
    selectProject(null)
    for (const [, procedure, hook] of reads) {
      const { mock, wrapper } = createValidatingTrpcHarness(handlers())
      renderHook(hook, { wrapper })
      await Promise.resolve()
      expect(mock.requests().filter((r) => r.procedure === procedure)).toHaveLength(0)
    }
  })

  it('keeps two projects, two asset files and two explore seeds in separate cache entries', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness(handlers())

    const first = renderHook(() => useActiveReview(), { wrapper })
    await waitFor(() => expect(first.result.current.active).not.toBeUndefined())
    const afterFirst = mock.requests().filter((r) => r.procedure === 'activeReview').length
    first.unmount()

    selectProject(OTHER)
    const second = renderHook(() => useActiveReview(), { wrapper })
    await waitFor(() => expect(second.result.current.active).not.toBeUndefined())
    // A shared cache entry would have served the second project from memory with no new read.
    expect(mock.requests().filter((r) => r.procedure === 'activeReview').length).toBeGreaterThan(
      afterFirst,
    )
    second.unmount()

    selectProject(PROJECT)
    renderHook(() => useEvidenceAsset('a.png', true), { wrapper })
    renderHook(() => useEvidenceAsset('b.png', true), { wrapper })
    await waitFor(() =>
      expect(mock.requests().filter((r) => r.procedure === 'reviewEvidenceAsset')).toHaveLength(2),
    )

    renderHook(() => useExplore('src/a.ts'), { wrapper })
    renderHook(() => useExplore('src/a.ts', 'value'), { wrapper })
    await waitFor(() =>
      expect(mock.requests().filter((r) => r.procedure === 'exploreReading')).toHaveLength(2),
    )
  })

  it('fetches a document body only once its pill is enabled', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness(handlers())
    const { rerender } = renderHook(({ on }: { on: boolean }) => useEvidenceDoc(docFile, on), {
      initialProps: { on: false },
      wrapper,
    })
    await Promise.resolve()
    expect(mock.requests().filter((r) => r.procedure === 'reviewEvidenceDoc')).toHaveLength(0)

    rerender({ on: true })
    await waitFor(() =>
      expect(mock.requests().filter((r) => r.procedure === 'reviewEvidenceDoc')).toHaveLength(1),
    )
  })

  it('fetches asset bytes only once the tile is enabled', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness(handlers())
    const { rerender } = renderHook(({ on }: { on: boolean }) => useEvidenceAsset(assetFile, on), {
      initialProps: { on: false },
      wrapper,
    })
    await Promise.resolve()
    expect(mock.requests().filter((r) => r.procedure === 'reviewEvidenceAsset')).toHaveLength(0)

    rerender({ on: true })
    await waitFor(() =>
      expect(mock.requests().filter((r) => r.procedure === 'reviewEvidenceAsset')).toHaveLength(1),
    )
  })

  it('exposes refresh and distinguishes loading from "No review yet"', async () => {
    const empty = createValidatingTrpcHarness(
      handlers({
        activeReview: () => ({ ok: true, value: null }),
        reviewReading: () => ({ ok: true, value: null }),
      }),
    )
    const active = renderHook(() => useActiveReview(), { wrapper: empty.wrapper })
    const reading = renderHook(() => useReviewReading(), { wrapper: empty.wrapper })
    expect(active.result.current.active).toBeUndefined()
    expect(reading.result.current.reading).toBeUndefined()

    await waitFor(() => expect(active.result.current.active).toBeNull())
    await waitFor(() => expect(reading.result.current.reading).toBeNull())
    await active.result.current.refresh()
    await reading.result.current.refresh()
  })
})
