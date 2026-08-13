import type { EvidenceAsset, ReviewDoc } from '@porcelain/contracts/review'
import type { EvidenceCheck } from '@shared/evidence-check'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EvidencePanel } from './evidence-panel'
import { useEvidenceAssets, useReviewEvidenceDocs } from './review-queries'

// Mock the domain hooks, never tRPC (the component-test rule). The gallery's own
// per-asset bodies are covered by evidence-gallery.test.tsx.
vi.mock('./review-queries', () => ({
  useEvidenceAssets: vi.fn(),
  useEvidenceAsset: () => ({ asset: null, isLoading: false }),
  useReviewEvidenceDocs: vi.fn(),
}))
vi.mock('./review-mutations', () => ({
  useClearEvidence: () => ({ clear: async () => {}, isClearing: false }),
}))

const checks: EvidenceCheck[] = [
  { label: 'pnpm test', status: 'pass', detail: '412 passed' },
  { label: 'browser e2e', status: 'fail' },
]

const docs: ReviewDoc[] = [
  { file: 'index.html', label: 'Report', medium: 'html', body: '<p>report</p>' },
  { file: 'notes.md', label: 'Notes', medium: 'markdown', body: '# Run log heading' },
]

const assets: EvidenceAsset[] = [
  { file: 'shot.png', label: 'Shot', kind: 'image', mime: 'image/png', bytes: 2048 },
]

function renderPanel(): void {
  render(
    <EvidencePanel title="Test evidence" updatedAt="2024-01-01T12:00:00.000Z" checks={checks} />,
  )
}

describe('EvidencePanel', () => {
  beforeEach(() => {
    vi.mocked(useReviewEvidenceDocs).mockReturnValue(docs)
    vi.mocked(useEvidenceAssets).mockReturnValue(assets)
  })

  it('counts each part of the pack in its sub-tab', () => {
    renderPanel()
    expect(screen.getByTestId(TestIds.evidenceSubTab('checks'))).toHaveTextContent('Checks2')
    expect(screen.getByTestId(TestIds.evidenceSubTab('results'))).toHaveTextContent('Results2')
    expect(screen.getByTestId(TestIds.evidenceSubTab('assets'))).toHaveTextContent('Assets1')
  })

  it('opens on Checks and switches to Results and Assets', () => {
    renderPanel()
    expect(screen.getByTestId(TestIds.evidenceChecksPane)).toBeInTheDocument()
    expect(screen.getByText('pnpm test')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId(TestIds.evidenceSubTab('results')))
    expect(screen.getByTestId(TestIds.evidenceResultsPane)).toBeInTheDocument()
    expect(screen.queryByTestId(TestIds.evidenceChecksPane)).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId(TestIds.evidenceSubTab('assets')))
    expect(screen.getByTestId(TestIds.evidenceGallery)).toBeInTheDocument()
  })

  it('disables an empty sub-tab instead of hiding it, and refuses the switch', () => {
    vi.mocked(useEvidenceAssets).mockReturnValue([])
    renderPanel()
    const assetsTab = screen.getByTestId(TestIds.evidenceSubTab('assets'))
    // Visible and counted zero — the shape of the pack stays legible.
    expect(assetsTab).toBeInTheDocument()
    expect(assetsTab).toHaveTextContent('Assets0')
    expect(assetsTab).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(assetsTab)
    expect(screen.queryByTestId(TestIds.evidenceGallery)).not.toBeInTheDocument()
    expect(screen.getByTestId(TestIds.evidenceChecksPane)).toBeInTheDocument()
  })

  it('opens on the first non-empty sub-tab when there are no checks', () => {
    render(<EvidencePanel title="Test evidence" updatedAt="2024-01-01T12:00:00.000Z" checks={[]} />)
    expect(screen.getByTestId(TestIds.evidenceSubTab('checks'))).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByTestId(TestIds.evidenceResultsPane)).toBeInTheDocument()
  })

  it('switches Results documents from the pill strip', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(TestIds.evidenceSubTab('results')))
    // Default doc is the HTML report — sandboxed iframe, never a src URL.
    expect(screen.getByTestId(TestIds.evidenceIframe).getAttribute('sandbox')).toBe('')
    fireEvent.click(screen.getByTestId(TestIds.intentDocTab('Notes')))
    expect(screen.queryByTestId(TestIds.evidenceIframe)).not.toBeInTheDocument()
    expect(screen.getByText('Run log heading')).toBeInTheDocument()
  })
})
