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
  useArchivedReviews,
  useEvidenceAsset,
  useEvidenceAssets,
  useEvidenceHtml,
  useExplore,
  useReviewEvidence,
  useReviewEvidenceDocs,
  useReviewIntent,
  useReviewPublishCost,
  useReviewReading,
  useReviewView,
} from './review-queries'

const F = reviewContractFixtures
const PROJECT = F.featureView.input
const OTHER = '/synthetic/other'

function handlers(overrides: DaemonMockHandlers = {}): DaemonMockHandlers {
  return {
    daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
    featureView: () => ({ ok: true, value: F.featureView.output }),
    featureReading: () => ({ ok: true, value: F.featureReading.output }),
    reviewIntent: () => ({ ok: true, value: F.reviewIntent.output }),
    reviewEvidenceDocs: () => ({ ok: true, value: F.reviewEvidenceDocs.output }),
    reviewPublishCost: () => ({ ok: true, value: F.reviewPublishCost.output }),
    loopEvidence: () => ({ ok: true, value: F.loopEvidence.output }),
    loopEvidenceHtml: () => ({ ok: true, value: F.loopEvidenceHtml.output }),
    reviewEvidenceAssets: () => ({ ok: true, value: F.reviewEvidenceAssets.output }),
    reviewEvidenceAsset: () => ({ ok: true, value: F.reviewEvidenceAsset.output }),
    archivedReviews: () => ({ ok: true, value: F.archivedReviews.output }),
    exploreFeature: () => ({ ok: true, value: F.exploreFeature.output }),
    ...overrides,
  }
}

function selectProject(path: string | null): void {
  useProjectSelectionStore.setState({ project: path === null ? null : { name: 'repo', path } })
}

const assetFile = F.reviewEvidenceAsset.input.file
const seed = { kind: 'file' as const, path: 'src/changed.ts' }

/** The eleven reads, each with the live procedure it must reach exactly once. */
const reads = [
  ['useReviewView', 'featureView', () => useReviewView()],
  ['useReviewReading', 'featureReading', () => useReviewReading()],
  ['useReviewIntent', 'reviewIntent', () => useReviewIntent()],
  ['useReviewEvidenceDocs', 'reviewEvidenceDocs', () => useReviewEvidenceDocs()],
  ['useReviewPublishCost', 'reviewPublishCost', () => useReviewPublishCost(true)],
  ['useReviewEvidence', 'loopEvidence', () => useReviewEvidence()],
  ['useEvidenceHtml', 'loopEvidenceHtml', () => useEvidenceHtml(PROJECT)],
  ['useEvidenceAssets', 'reviewEvidenceAssets', () => useEvidenceAssets()],
  ['useEvidenceAsset', 'reviewEvidenceAsset', () => useEvidenceAsset(assetFile, true)],
  ['useArchivedReviews', 'archivedReviews', () => useArchivedReviews()],
  ['useExplore', 'exploreFeature', () => useExplore(seed.path)],
] as const

describe('Review read adapter', () => {
  beforeEach(() => {
    selectProject(PROJECT)
  })

  it('reads each of the eleven live procedures through the validating daemon mock', async () => {
    expect(reads).toHaveLength(11)
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
      // `useEvidenceHtml` is keyed by the path its caller passes, so the disabled case is
      // the empty path rather than the empty selection.
      if (procedure === 'loopEvidenceHtml') continue
      const { mock, wrapper } = createValidatingTrpcHarness(handlers())
      renderHook(hook, { wrapper })
      await Promise.resolve()
      expect(mock.requests().filter((r) => r.procedure === procedure)).toHaveLength(0)
    }
    const { mock, wrapper } = createValidatingTrpcHarness(handlers())
    renderHook(() => useEvidenceHtml(''), { wrapper })
    await Promise.resolve()
    expect(mock.requests().filter((r) => r.procedure === 'loopEvidenceHtml')).toHaveLength(0)
  })

  it('keeps two projects, two asset files and two explore seeds in separate cache entries', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness(handlers())

    const first = renderHook(() => useReviewView(), { wrapper })
    await waitFor(() => expect(first.result.current.view).not.toBeUndefined())
    const afterFirst = mock.requests().filter((r) => r.procedure === 'featureView').length
    first.unmount()

    selectProject(OTHER)
    const second = renderHook(() => useReviewView(), { wrapper })
    await waitFor(() => expect(second.result.current.view).not.toBeUndefined())
    // A shared cache entry would have served the second project from memory with no new read.
    expect(mock.requests().filter((r) => r.procedure === 'featureView').length).toBeGreaterThan(
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
      expect(mock.requests().filter((r) => r.procedure === 'exploreFeature')).toHaveLength(2),
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
        featureView: () => ({ ok: true, value: null }),
        featureReading: () => ({ ok: true, value: null }),
      }),
    )
    const view = renderHook(() => useReviewView(), { wrapper: empty.wrapper })
    const reading = renderHook(() => useReviewReading(), { wrapper: empty.wrapper })
    expect(view.result.current.view).toBeUndefined()
    expect(reading.result.current.reading).toBeUndefined()

    await waitFor(() => expect(view.result.current.view).toBeNull())
    await waitFor(() => expect(reading.result.current.reading).toBeNull())
    await view.result.current.refresh()
    await reading.result.current.refresh()
  })
})
