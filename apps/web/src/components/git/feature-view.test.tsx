import type { FeatureReading } from '@backend/review/feature-view'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeatureView } from './feature-view'

// Mock the domain hook, never tRPC (the component-test rule).
vi.mock('@renderer/hooks/use-feature-reading', () => ({
  useFeatureReading: vi.fn(),
}))
vi.mock('@renderer/hooks/use-reviewed', () => ({
  useReviewedPaths: () => new Set<string>(),
}))
// The Evidence tab mounts EvidencePanel; stub its pack hooks so the canvas can be
// exercised without a query provider (the panel's own tests cover the sub-tabs).
vi.mock('@renderer/hooks/use-review-intent', () => ({
  useReviewIntent: () => [],
  useReviewEvidenceDocs: () => [],
}))
vi.mock('@renderer/hooks/use-evidence', () => ({
  useClearEvidence: () => ({ clear: async () => {}, isClearing: false }),
  useEvidenceAssets: () => [],
  useEvidenceAsset: () => ({ asset: null, isLoading: false }),
}))
// copyText goes through the utils helper (navigator.clipboard is absent on the
// tailnet client AND in jsdom); spy on it instead of the clipboard.
const copySpy = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@renderer/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  copyText: copySpy,
}))

describe('FeatureView', () => {
  beforeEach(() => {
    copySpy.mockClear()
  })

  it('shows a loading line while the reading is in flight', () => {
    vi.mocked(useFeatureReading).mockReturnValue({ reading: undefined, refresh: async () => {} })
    render(<FeatureView />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders the start-unit empty state when no review set exists', () => {
    vi.mocked(useFeatureReading).mockReturnValue({ reading: null, refresh: async () => {} })
    render(<FeatureView />)
    expect(screen.getByText('Start this unit of work')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copy begin-unit prompt/ })).toBeInTheDocument()
  })

  it('copies the begin-unit agent prompt from the empty state', () => {
    vi.mocked(useFeatureReading).mockReturnValue({ reading: null, refresh: async () => {} })
    render(<FeatureView />)
    fireEvent.click(screen.getByRole('button', { name: /Copy begin-unit prompt/ }))
    expect(copySpy).toHaveBeenCalledWith(expect.stringContaining('START of the unit'))
    expect(copySpy).toHaveBeenCalledWith(expect.stringContaining('porcelain-companion'))
  })

  // The pack gate widened daemon-side: evidence meta now arrives for a directory
  // with no index.html at all, so a checks-only pack must open the tab.
  it('enables the Evidence tab for a checks-only pack', () => {
    vi.mocked(useFeatureReading).mockReturnValue({
      reading: reading({
        title: 'Test evidence',
        updatedAt: '2024-01-01T12:00:00.000Z',
        checks: [{ label: 'pnpm test', status: 'pass' }],
        medium: 'html',
      }),
      refresh: async () => {},
    })
    render(<FeatureView />)
    const tab = screen.getByTestId(TestIds.featureCanvasTab('evidence'))
    expect(tab).toHaveAttribute('aria-disabled', 'false')
    fireEvent.click(tab)
    expect(screen.getByTestId(TestIds.evidencePanel)).toBeInTheDocument()
    expect(screen.getByTestId(TestIds.evidenceChecksPane)).toBeInTheDocument()
  })

  it('disables the Evidence tab when the repo has no pack', () => {
    vi.mocked(useFeatureReading).mockReturnValue({
      reading: reading(null),
      refresh: async () => {},
    })
    render(<FeatureView />)
    const tab = screen.getByTestId(TestIds.featureCanvasTab('evidence'))
    expect(tab).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(tab)
    expect(screen.queryByTestId(TestIds.evidencePanel)).not.toBeInTheDocument()
  })
})

function reading(evidence: FeatureReading['evidence']): FeatureReading {
  return { name: 'Evidence pack', sections: [], groups: [], evidence }
}
