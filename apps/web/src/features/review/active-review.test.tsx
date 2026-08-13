import type { ReviewReading } from '@porcelain/contracts/review'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ActiveReview } from './active-review'
import { useReviewReading } from './review-queries'

// Mock the domain hook, never tRPC (the component-test rule).
vi.mock('./review-queries', () => ({
  useReviewReading: vi.fn(),
  useReviewIntent: () => [],
  useReviewEvidence: () => null,
  useEvidenceDoc: () => ({ doc: null, isLoading: false }),
  useEvidenceAsset: () => ({ asset: null, isLoading: false }),
}))
vi.mock('./review-mutations', () => ({
  useClearEvidence: () => ({ clear: async () => {}, isClearing: false }),
}))
vi.mock('@renderer/features/git', () => ({
  useDiffFileHoverPrefetch: () => () => {},
  useReviewedPaths: () => new Set<string>(),
  useToggleReviewed: () => ({ mark: () => {}, unmark: () => {} }),
}))
// The Evidence tab mounts EvidencePanel; stub its pack hooks so the canvas can be
// exercised without a query provider (the panel's own tests cover the sub-tabs).

describe('ActiveReview', () => {
  it('shows a loading line while the reading is in flight', () => {
    vi.mocked(useReviewReading).mockReturnValue({ reading: undefined, refresh: async () => {} })
    render(<ActiveReview />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders the start-unit empty state when no review set exists', () => {
    vi.mocked(useReviewReading).mockReturnValue({ reading: null, refresh: async () => {} })
    render(<ActiveReview />)
    expect(screen.getByText('Start this unit of work')).toBeInTheDocument()
    // The lifecycle is agent-side now — the canvas names the skill, it doesn't ship a prompt.
    expect(screen.getByText(/porcelain-companion skill/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /prompt/i })).not.toBeInTheDocument()
  })

  // The pack gate widened daemon-side: evidence meta arrives for a directory with no
  // documents at all, so a checks-only pack must open the tab.
  it('enables the Evidence tab for a checks-only pack', () => {
    vi.mocked(useReviewReading).mockReturnValue({
      reading: reading({
        title: 'Test evidence',
        updatedAt: '2024-01-01T12:00:00.000Z',
        checks: [{ label: 'pnpm test', status: 'pass' }],
      }),
      refresh: async () => {},
    })
    render(<ActiveReview />)
    const tab = screen.getByTestId(TestIds.activeReviewTab('evidence'))
    expect(tab).toHaveAttribute('aria-disabled', 'false')
    fireEvent.click(tab)
    expect(screen.getByTestId(TestIds.evidencePanel)).toBeInTheDocument()
    expect(screen.getByTestId(TestIds.evidenceChecksPane)).toBeInTheDocument()
  })

  it('disables the Evidence tab when the repo has no pack', () => {
    vi.mocked(useReviewReading).mockReturnValue({
      reading: reading(null),
      refresh: async () => {},
    })
    render(<ActiveReview />)
    const tab = screen.getByTestId(TestIds.activeReviewTab('evidence'))
    expect(tab).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(tab)
    expect(screen.queryByTestId(TestIds.evidencePanel)).not.toBeInTheDocument()
  })
})

function reading(evidence: ReviewReading['evidence']): ReviewReading {
  return { name: 'Evidence pack', sections: [], groups: [], evidence }
}
