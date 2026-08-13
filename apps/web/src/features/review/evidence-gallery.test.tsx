import type { EvidenceAsset, EvidenceAssetBody } from '@porcelain/contracts/review'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EvidenceGallery } from './evidence-gallery'
import { useEvidenceAsset } from './review-queries'

// Mock the domain hook, never tRPC (the component-test rule).
vi.mock('./review-queries', () => ({
  useEvidenceAsset: vi.fn(),
}))

const assets: EvidenceAsset[] = [
  { file: 'login.png', label: 'Login', kind: 'image', mime: 'image/png', bytes: 4096 },
  { file: 'board.png', label: 'Board', kind: 'image', mime: 'image/png', bytes: 8192 },
]

const body = (file: string): EvidenceAssetBody => ({
  file,
  mime: 'image/png',
  bytes: 4096,
  dataUrl: `data:image/png;base64,${file}`,
})

describe('EvidenceGallery', () => {
  beforeEach(() => {
    vi.mocked(useEvidenceAsset).mockReset()
    vi.mocked(useEvidenceAsset).mockImplementation((file: string) => ({
      asset: body(file),
      isLoading: false,
    }))
  })

  it('renders one tile per asset with its label and size', () => {
    render(<EvidenceGallery assets={assets} active />)
    expect(screen.getByTestId(TestIds.evidenceGalleryItem('login.png'))).toHaveTextContent(
      'Login · 4 KB',
    )
    expect(screen.getByTestId(TestIds.evidenceGalleryItem('board.png'))).toHaveTextContent(
      'Board · 8 KB',
    )
  })

  it('holds the bytes back until the Assets sub-tab is the visible pane', () => {
    render(<EvidenceGallery assets={assets} active={false} />)
    expect(vi.mocked(useEvidenceAsset).mock.calls.every((call) => call[1] === false)).toBe(true)
  })

  it('shows a skeleton while a tile is in flight', () => {
    vi.mocked(useEvidenceAsset).mockReturnValue({ asset: undefined, isLoading: true })
    render(<EvidenceGallery assets={assets} active />)
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(2)
    expect(document.querySelector('img')).toBeNull()
  })

  it('opens the zoom dialog on a tile and steps with the arrow keys', () => {
    render(<EvidenceGallery assets={assets} active />)
    fireEvent.click(screen.getByTestId(TestIds.evidenceGalleryItem('login.png')))
    const zoom = screen.getByTestId(TestIds.evidenceGalleryZoom)
    expect(zoom).toBeInTheDocument()
    expect(within(zoom).getByAltText('Login')).toHaveAttribute(
      'src',
      'data:image/png;base64,login.png',
    )
    fireEvent.keyDown(zoom, { key: 'ArrowRight' })
    expect(within(zoom).getByAltText('Board')).toBeInTheDocument()
    fireEvent.keyDown(zoom, { key: 'ArrowLeft' })
    expect(within(zoom).getByAltText('Login')).toBeInTheDocument()
  })

  it('names the size instead of guessing when a body is over the cap', () => {
    vi.mocked(useEvidenceAsset).mockReturnValue({ asset: null, isLoading: false })
    render(
      <EvidenceGallery
        assets={[
          { file: 'huge.png', label: 'Huge', kind: 'image', mime: 'image/png', bytes: 6_291_456 },
        ]}
        active
      />,
    )
    expect(screen.getByTestId(TestIds.evidenceGalleryItem('huge.png'))).toHaveTextContent(
      'Too large to preview (6.0 MB)',
    )
  })
})
